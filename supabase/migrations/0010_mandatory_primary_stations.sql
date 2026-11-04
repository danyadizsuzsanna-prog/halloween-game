-- ============================================================================
-- 0010 — (PO 2026-11-04) Mind a 12 rendes állomás kötelező, hogy az idő összehasonlítható legyen
--
-- Indok: a 6 állomásos "gyors beküldés" nyerhetett az idővel, miközben aki mind a
-- 12 állomást végigjárta (és a két példány közül válogatott), hátrányba került.
--
-- 1. Beküldési kapu (submit_ritual): a rituálé csak akkor küldhető be, ha a csapat
--    mind a rendes állomást teljesítette (kész vagy lejárt próbálkozás), VAGY már
--    lejárt a gyűjtési idő (game_config.ends_at). A határidő (ritual_deadline)
--    után továbbra sem lehet beküldeni.
-- 2. Irányajánló (_routing_candidates):
--      - rendes állomás: mindig ajánlható, ahol a csapat még nem járt (az utolsó
--        10 perces "csak hiányzó alapanyag" korlátozás megszűnt);
--      - tartalék állomás: azonnal ajánlható, amint az alapanyag hiányzik ÉS az
--        alapanyag mindkét rendes állomásán már jártak (az utolsó 10 perces
--        korlátozás megszűnt).
--      - a 0008 többi szabálya marad: csak szabad helyszín (max. 2), ha nincs
--        szabad, 1 várakozós, foglalt nem választható.
-- 3. get_ritual_gate(): a kliensnek a haladás (X/N) és a kapu állapota.
--
-- Nem tartalmaz titkot, a repóba mehet. Idempotens.
-- ============================================================================

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
  ),
  mine as (
    select ti.ingredient_id from team_inventory ti where ti.team_id = p_team
  )
  select s.id, s.ingredient_id, (s.kind = 'backup'), (o.sid is not null), coalesce(o.secs, 0)
  from stations s
  left join occ o on o.sid = s.id
  where s.id not in (select a.station_id from team_station_attempts a
                     where a.team_id = p_team)
    and (
      -- rendes állomás: bármelyik, ahol még nem jártak
      s.kind = 'primary'
      or
      -- tartalék: ha az alapanyag hiányzik, és mindkét rendes állomásán már jártak
      (s.kind = 'backup'
        and s.ingredient_id not in (select m.ingredient_id from mine m)
        and not exists (select 1 from stations p2
                        where p2.ingredient_id = s.ingredient_id
                          and p2.kind = 'primary'
                          and p2.id not in (select a.station_id
                                            from team_station_attempts a
                                            where a.team_id = p_team)))
    );
$$ language sql stable security definer set search_path = public;

revoke execute on function _routing_candidates(uuid, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Haladás és beküldési kapu (a csapat saját adata)
-- "kész" = a próbálkozás befejeződött, vagy az 5 perces ideje lejárt
-- ----------------------------------------------------------------------------
create or replace function _ritual_gate(p_team uuid)
returns table (primary_total int, primary_done int, gather_over boolean, can_submit boolean)
as $$
  with t as (
    select count(*)::int as total from stations where kind = 'primary'
  ),
  d as (
    select count(*)::int as done
    from stations s
    join team_station_attempts a on a.station_id = s.id and a.team_id = p_team
    where s.kind = 'primary'
      and (a.completed_at is not null
           or coalesce(a.started_at + interval '5 minutes',
                       a.chosen_at + interval '4 minutes') <= now())
  ),
  g as (
    select coalesce(now() > (select ends_at from game_config where id = true), false) as over
  )
  select t.total, d.done, g.over, (d.done >= t.total or g.over)
  from t, d, g;
$$ language sql stable security definer set search_path = public;

revoke execute on function _ritual_gate(uuid) from public, anon, authenticated;

create or replace function get_ritual_gate()
returns table (primary_total int, primary_done int, gather_over boolean, can_submit boolean)
as $$
declare
  v_team_id uuid;
begin
  select p.team_id into v_team_id from profiles p where p.id = auth.uid();
  if v_team_id is null then
    return;
  end if;
  return query select * from _ritual_gate(v_team_id);
end;
$$ language plpgsql stable security definer set search_path = public;

revoke execute on function get_ritual_gate() from public, anon;
grant execute on function get_ritual_gate() to authenticated;

-- ----------------------------------------------------------------------------
-- submit_ritual: a 0007-es törzs + beküldési kapu
-- ----------------------------------------------------------------------------
create or replace function submit_ritual(p_inventory_ids uuid[])
returns uuid as $$
declare
  v_team_id uuid;
  v_is_captain boolean;
  v_deadline timestamptz;
  v_total int;
  v_done int;
  v_can boolean;
  v_rows int;
  v_distinct int;
  v_is_complete boolean;
  v_infected int;
  v_final_monster monster_type;
  v_score numeric;
  v_id uuid;
begin
  select p.team_id, p.is_captain into v_team_id, v_is_captain
  from profiles p where p.id = auth.uid();
  if not v_is_captain then
    raise exception 'Csak a kapitány küldheti be a rituálét.';
  end if;

  select g.ritual_deadline into v_deadline from game_config g where g.id = true;
  if v_deadline is null or now() > v_deadline then
    raise exception 'Lejárt az idő, a rituálé már nem küldhető be.';
  end if;

  if exists (select 1 from ritual_submissions r where r.team_id = v_team_id) then
    raise exception 'A rituálétokat már beküldtétek.';
  end if;

  -- kapu: mind a rendes állomás, vagy lejárt a gyűjtési idő
  select gt.primary_total, gt.primary_done, gt.can_submit into v_total, v_done, v_can
  from _ritual_gate(v_team_id) gt;
  if not coalesce(v_can, false) then
    raise exception 'Még nem küldhetitek be: előbb járjátok végig mind a % rendes állomást (most: %/%), vagy várjátok meg a gyűjtési idő végét.',
      v_total, v_done, v_total;
  end if;

  select count(*), count(distinct ti.ingredient_id) into v_rows, v_distinct
  from team_inventory ti
  where ti.id = any(p_inventory_ids) and ti.team_id = v_team_id;

  if v_rows <> coalesce(array_length(p_inventory_ids, 1), 0) or v_rows <> v_distinct then
    raise exception 'Alapanyagonként pontosan egy példányt használhattok.';
  end if;

  v_is_complete := (v_distinct = 6);

  select count(*) into v_infected
  from team_inventory ti
  where ti.id = any(p_inventory_ids) and ti.team_id = v_team_id and ti.is_infected;

  if v_is_complete and v_infected > 0 then
    select coalesce(a.monster, ao.monster) into v_final_monster
    from team_inventory ti
    join team_station_attempts a on a.id = ti.attempt_id
    left join answer_options ao on ao.id = a.chosen_option_id
    where ti.id = any(p_inventory_ids) and ti.team_id = v_team_id and ti.is_infected
    group by coalesce(a.monster, ao.monster)
    order by count(*) desc, random()
    limit 1;
  end if;

  if v_is_complete and v_infected = 0 then
    select avg(case when ti.freshness = 'fresh' then 1.0 else 0.5 end) into v_score
    from team_inventory ti
    where ti.id = any(p_inventory_ids) and ti.team_id = v_team_id;
  end if;

  insert into ritual_submissions
    (team_id, used_inventory_ids, is_complete, final_monster, freshness_score)
  values (v_team_id, p_inventory_ids, v_is_complete, v_final_monster, v_score)
  returning id into v_id;

  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function submit_ritual(uuid[]) from public, anon;
grant execute on function submit_ritual(uuid[]) to authenticated;

notify pgrst, 'reload schema';
