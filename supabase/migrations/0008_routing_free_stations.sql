-- ============================================================================
-- 0008 — Irányajánló: csak szabad helyszín, csak hiányzó alapanyag
-- (PO jóváhagyta 2026-11-04; nem tartalmaz titkot, a repóba mehet)
--
-- Szabályok:
--  1. Csak olyan állomást ajánl, amelynek az alapanyaga még NINCS a csapatnál
--     (az egész játék alatt, nem csak az utolsó 10 percben), és ahol a csapat
--     még nem járt.
--  2. Szabad állomásból legfeljebb 2-t ajánl. Ha nincs szabad, pontosan 1
--     foglaltat (a leghamarabb felszabadulót), a várakozási idővel.
--  3. Foglalt állomást nem lehet választani (choose_station elutasítja);
--     ha közben szabaddá válik, az ajánlat magától frissül.
--  4. A tartalék állomás továbbra is csak az utolsó 10 percben, és csak ha az
--     alapanyag mindkét rendes állomásán már jártak.
--
-- Idempotens: többször is lefuttatható.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Segédfüggvény: egy csapat számára választható állomások + foglaltság
-- (csak a másik két függvény hívja; kliens nem érheti el)
-- ----------------------------------------------------------------------------
create or replace function _routing_candidates(p_team uuid, p_ends timestamptz)
returns table (
  station_id uuid, ingredient_id uuid, is_backup boolean, busy boolean, secs int
) as $$
  with occ as (
    select a.station_id as sid,
           max(greatest(0, extract(epoch from (
             coalesce(a.started_at + interval '5 minutes',
                      a.chosen_at + interval '4 minutes') - now()))::int)) as secs
    from team_station_attempts a
    where a.completed_at is null
      and a.team_id <> p_team
      and coalesce(a.started_at + interval '5 minutes',
                   a.chosen_at + interval '4 minutes') > now()
    group by a.station_id
  )
  select s.id, s.ingredient_id, (s.kind = 'backup'), (o.sid is not null), coalesce(o.secs, 0)
  from stations s
  left join occ o on o.sid = s.id
  where s.id not in (select a.station_id from team_station_attempts a
                     where a.team_id = p_team)
    and s.ingredient_id not in (select ti.ingredient_id from team_inventory ti
                                where ti.team_id = p_team)
    and (
      s.kind = 'primary'
      or (
        now() > p_ends - interval '10 minutes'
        and not exists (select 1 from stations p2
                        where p2.ingredient_id = s.ingredient_id
                          and p2.kind = 'primary'
                          and p2.id not in (select a.station_id
                                            from team_station_attempts a
                                            where a.team_id = p_team))
      )
    );
$$ language sql stable security definer set search_path = public;

revoke execute on function _routing_candidates(uuid, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Ajánlat (a kapitány kérdezi le; a helyszín nevét NEM adja vissza)
-- ----------------------------------------------------------------------------
create or replace function get_routing_options()
returns table (
  station_id uuid, ingredient_name text, is_backup boolean,
  is_busy boolean, busy_seconds_left int
) as $$
declare
  v_team_id uuid;
  v_ends_at timestamptz;
  v_old uuid[];
  v_new uuid[];
begin
  select p.team_id into v_team_id from profiles p where p.id = auth.uid();
  if v_team_id is null then return; end if;

  select g.ends_at into v_ends_at from game_config g where g.id = true;
  if v_ends_at is null or now() > v_ends_at then return; end if;

  perform expire_stale_attempts(v_team_id);

  if exists (select 1 from team_station_attempts a
             where a.team_id = v_team_id and a.completed_at is null) then
    return;
  end if;

  select o.station_ids into v_old from team_offers o where o.team_id = v_team_id;
  v_old := coalesce(v_old, '{}');

  if exists (select 1 from _routing_candidates(v_team_id, v_ends_at) c where not c.busy) then
    -- szabad állomások: a korábban ajánlott, még szabadok maradnak, a többi véletlen
    select coalesce(array_agg(x.sid), '{}') into v_new
    from (
      select c.station_id as sid
      from _routing_candidates(v_team_id, v_ends_at) c
      where not c.busy
      order by (c.station_id = any(v_old)) desc, random()
      limit 2
    ) x;
  else
    -- nincs szabad: pontosan 1 várakozós, a leghamarabb felszabaduló
    select coalesce(array_agg(x.sid), '{}') into v_new
    from (
      select c.station_id as sid
      from _routing_candidates(v_team_id, v_ends_at) c
      order by c.secs, (c.station_id = any(v_old)) desc, c.station_id
      limit 1
    ) x;
  end if;

  if array_length(v_new, 1) is null then
    delete from team_offers where team_id = v_team_id;
    return;
  end if;

  insert into team_offers (team_id, station_ids, created_at)
  values (v_team_id, v_new, now())
  on conflict (team_id) do update
    set station_ids = excluded.station_ids, created_at = excluded.created_at;

  return query
  select c.station_id, i.name, c.is_backup, c.busy,
         case when c.busy then c.secs end
  from _routing_candidates(v_team_id, v_ends_at) c
  join ingredients i on i.id = c.ingredient_id
  where c.station_id = any(v_new)
  order by c.busy, c.station_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- Irány kiválasztása (csak kapitány) — foglalt állomást nem enged
-- ----------------------------------------------------------------------------
create or replace function choose_station(p_station_id uuid)
returns text as $$
declare
  v_team_id uuid;
  v_is_captain boolean;
  v_ends_at timestamptz;
  v_offer uuid[];
  v_busy boolean;
  v_room text;
begin
  select p.team_id, p.is_captain into v_team_id, v_is_captain
  from profiles p where p.id = auth.uid();
  if not coalesce(v_is_captain, false) then
    raise exception 'Csak a kapitány választhat irányt.';
  end if;

  select g.ends_at into v_ends_at from game_config g where g.id = true;
  if v_ends_at is null or now() > v_ends_at then
    raise exception 'A gyűjtögető idő nem aktív.';
  end if;

  -- a választások sorba állítva futnak: két csapat nem foglalhatja le egyszerre
  -- ugyanazt az állomást
  perform pg_advisory_xact_lock(hashtext('halloween_routing'));

  perform expire_stale_attempts(v_team_id);
  if exists (select 1 from team_station_attempts a
             where a.team_id = v_team_id and a.completed_at is null) then
    raise exception 'Már van aktív célotok.';
  end if;

  select o.station_ids into v_offer from team_offers o where o.team_id = v_team_id;
  if v_offer is null or not (p_station_id = any(v_offer)) then
    raise exception 'Ez az állomás nem szerepel az ajánlatban.';
  end if;

  select c.busy into v_busy
  from _routing_candidates(v_team_id, v_ends_at) c
  where c.station_id = p_station_id;
  if not found then
    raise exception 'Ez az állomás már nem választható — az ajánlat frissül.';
  end if;
  if v_busy then
    raise exception 'Ott éppen egy másik csapat dolgozik — várjatok, amíg felszabadul.';
  end if;

  insert into team_station_attempts (team_id, station_id) values (v_team_id, p_station_id);
  delete from team_offers where team_id = v_team_id;

  select s.room_name into v_room from stations s where s.id = p_station_id;
  return v_room;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function get_routing_options(), choose_station(uuid) from public, anon;
grant execute on function get_routing_options(), choose_station(uuid) to authenticated;

notify pgrst, 'reload schema';
