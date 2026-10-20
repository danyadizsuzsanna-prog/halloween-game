-- ============================================================================
-- 0002 — QR-alapú állomás-flow, szigorúbb jogosultságok, email-engedélylista
-- Futtasd le EGYSZER, az 0001_schema.sql és a seed_data.sql UTÁN.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EMAIL-ENGEDÉLYLISTA
--    Beléphet: aki a listázott domainek egyikéről ír, VAGY szerepel az
--    allowed_emails táblában (külsős vendégek). Mindkét táblát a Supabase
--    Table Editorában kell kezelni. A meglévő felhasználók automatikusan
--    bekerülnek, hogy ne zárd ki magad.
-- ----------------------------------------------------------------------------

create table if not exists allowed_domains (domain text primary key);
create table if not exists allowed_emails (email text primary key);
alter table allowed_domains enable row level security;
alter table allowed_emails enable row level security;

insert into allowed_emails (email)
select lower(email) from auth.users where email is not null
on conflict do nothing;

create or replace function is_email_allowed(p_email text)
returns boolean as $$
  select exists (select 1 from allowed_emails where email = lower(trim(p_email)))
      or exists (select 1 from allowed_domains
                 where domain = lower(split_part(trim(p_email), '@', 2)));
$$ language sql security definer stable set search_path = public;

grant execute on function is_email_allowed(text) to anon, authenticated;

create or replace function enforce_email_allowlist()
returns trigger as $$
begin
  if not is_email_allowed(new.email) then
    raise exception 'Ez az email cím nem engedélyezett.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists a_enforce_allowlist on auth.users;
create trigger a_enforce_allowlist before insert on auth.users
  for each row execute function enforce_email_allowlist();

-- ----------------------------------------------------------------------------
-- 2. TÁBLA-MÓDOSÍTÁSOK
-- ----------------------------------------------------------------------------

-- Az attempt két lépésben jön létre: "chosen_at" = a kapitány kiválasztotta,
-- "started_at" = a csapat beolvasta az állomás QR-kódját (ekkor indul az óra).
alter table team_station_attempts alter column started_at drop not null;
alter table team_station_attempts alter column started_at drop default;
alter table team_station_attempts add column if not exists chosen_at timestamptz not null default now();

-- A rituálé beküldésének határideje külön van a gyűjtögető fázis végétől.
alter table game_config add column if not exists ritual_deadline timestamptz;

-- Az ajánlott 2 irány csapatonként tartósan tárolva (frissítésre se változzon).
create table if not exists team_offers (
  team_id uuid primary key references teams(id) on delete cascade,
  station_ids uuid[] not null,
  created_at timestamptz not null default now()
);
alter table team_offers enable row level security;

-- Kitalálhatatlan QR-kódok (eddig RITUAL-01… volt). Csak egyszer futtasd!
update stations set qr_code = upper(substr(md5(random()::text || id::text), 1, 8));

-- ----------------------------------------------------------------------------
-- 3. RÉGI, ELAVULT ELEMEK TÖRLÉSE
-- ----------------------------------------------------------------------------

drop function if exists start_attempt(uuid);
drop function if exists get_routing_options(timestamptz);
drop function if exists submit_ritual(uuid[], timestamptz);
drop function if exists start_game(int);
drop view if exists public_tasks;
drop view if exists public_answer_options;
drop policy if exists "own team ritual" on ritual_submissions;

-- ----------------------------------------------------------------------------
-- 4. SEGÉDFÜGGVÉNY: lejárt (5 percnél régebbi) próbálkozások lezárása
-- ----------------------------------------------------------------------------

create or replace function expire_stale_attempts(p_team_id uuid)
returns void as $$
begin
  update team_station_attempts
  set completed_at = started_at + interval '5 minutes', result = 'failed'
  where team_id = p_team_id
    and completed_at is null
    and started_at is not null
    and started_at + interval '5 minutes' < now();
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function expire_stale_attempts(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. AKTUÁLIS CÉL (minden csapattag látja; a helyszín csak itt derül ki)
-- ----------------------------------------------------------------------------

create or replace function get_current_target()
returns table (
  station_id uuid, room_name text, ingredient_name text, is_backup boolean,
  chosen_at timestamptz, started_at timestamptz, server_now timestamptz
) as $$
declare
  v_team_id uuid;
begin
  select p.team_id into v_team_id from profiles p where p.id = auth.uid();
  perform expire_stale_attempts(v_team_id);
  return query
  select a.station_id, s.room_name, i.name, (s.kind = 'backup'),
         a.chosen_at, a.started_at, now()
  from team_station_attempts a
  join stations s on s.id = a.station_id
  join ingredients i on i.id = s.ingredient_id
  where a.team_id = v_team_id and a.completed_at is null
  limit 1;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 6. ÚTVONAL-AJÁNLÓ (a kapitány kérdezi le; a helyszínt NEM adja vissza)
--    - rendes állomások: bármelyik még nem látogatott; az utolsó 10 percben
--      csak a hiányzó alapanyagokhoz tartozók
--    - tartalék állomás: csak az utolsó 10 percben, csak ha az adott
--      alapanyagnál MINDKÉT rendes állomáson már voltak és nincs meg az elem
--    - foglalt = másik csapat épp úton van oda, vagy ott dolgozik
-- ----------------------------------------------------------------------------

create or replace function get_routing_options()
returns table (
  station_id uuid, ingredient_name text, is_backup boolean,
  is_busy boolean, busy_seconds_left int
) as $$
declare
  v_team_id uuid;
  v_ends_at timestamptz;
  v_last10 boolean;
  v_offer uuid[];
  v_offer_created timestamptz;
begin
  select p.team_id into v_team_id from profiles p where p.id = auth.uid();
  select g.ends_at into v_ends_at from game_config g where g.id = true;
  if v_ends_at is null or now() > v_ends_at then return; end if;

  perform expire_stale_attempts(v_team_id);

  if exists (select 1 from team_station_attempts a
             where a.team_id = v_team_id and a.completed_at is null) then
    return;
  end if;

  v_last10 := now() > v_ends_at - interval '10 minutes';

  select o.station_ids, o.created_at into v_offer, v_offer_created
  from team_offers o where o.team_id = v_team_id;

  if v_offer is null
     or (v_last10 and v_offer_created < v_ends_at - interval '10 minutes') then
    with occ as (
      select a.station_id
      from team_station_attempts a
      where a.completed_at is null and a.team_id <> v_team_id
        and coalesce(a.started_at + interval '5 minutes',
                     a.chosen_at + interval '4 minutes') > now()
    ),
    cand as (
      select s.id, (o.station_id is not null) as busy
      from stations s
      left join occ o on o.station_id = s.id
      where s.id not in (select a.station_id from team_station_attempts a
                         where a.team_id = v_team_id)
        and (
          (s.kind = 'primary'
            and (not v_last10
                 or s.ingredient_id not in (select ti.ingredient_id from team_inventory ti
                                            where ti.team_id = v_team_id)))
          or
          (s.kind = 'backup' and v_last10
            and s.ingredient_id not in (select ti.ingredient_id from team_inventory ti
                                        where ti.team_id = v_team_id)
            and not exists (select 1 from stations p2
                            where p2.ingredient_id = s.ingredient_id
                              and p2.kind = 'primary'
                              and p2.id not in (select a.station_id
                                                from team_station_attempts a
                                                where a.team_id = v_team_id)))
        )
    )
    select coalesce(array_agg(c.id), '{}') into v_offer
    from (select cand.id from cand order by cand.busy, random() limit 2) c;

    if array_length(v_offer, 1) is not null then
      insert into team_offers (team_id, station_ids, created_at)
      values (v_team_id, v_offer, now())
      on conflict (team_id) do update
        set station_ids = excluded.station_ids, created_at = excluded.created_at;
    end if;
  end if;

  return query
  with occ as (
    select a.station_id as sid,
           greatest(0, extract(epoch from (
             coalesce(a.started_at + interval '5 minutes',
                      a.chosen_at + interval '4 minutes') - now()))::int) as secs
    from team_station_attempts a
    where a.completed_at is null and a.team_id <> v_team_id
      and coalesce(a.started_at + interval '5 minutes',
                   a.chosen_at + interval '4 minutes') > now()
  )
  select s.id, i.name, (s.kind = 'backup'), (o.sid is not null), o.secs
  from stations s
  join ingredients i on i.id = s.ingredient_id
  left join occ o on o.sid = s.id
  where s.id = any(v_offer)
  order by (o.sid is not null), s.id;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 7. IRÁNY KIVÁLASZTÁSA (csak kapitány) — visszaadja a helyszín nevét
-- ----------------------------------------------------------------------------

create or replace function choose_station(p_station_id uuid)
returns text as $$
declare
  v_team_id uuid;
  v_is_captain boolean;
  v_ends_at timestamptz;
  v_offer uuid[];
  v_room text;
begin
  select p.team_id, p.is_captain into v_team_id, v_is_captain
  from profiles p where p.id = auth.uid();
  if not v_is_captain then
    raise exception 'Csak a kapitány választhat irányt.';
  end if;

  select g.ends_at into v_ends_at from game_config g where g.id = true;
  if v_ends_at is null or now() > v_ends_at then
    raise exception 'A gyűjtögető idő nem aktív.';
  end if;

  perform expire_stale_attempts(v_team_id);
  if exists (select 1 from team_station_attempts a
             where a.team_id = v_team_id and a.completed_at is null) then
    raise exception 'Már van aktív célotok.';
  end if;

  select o.station_ids into v_offer from team_offers o where o.team_id = v_team_id;
  if v_offer is null or not (p_station_id = any(v_offer)) then
    raise exception 'Ez az állomás nem szerepel az ajánlatban.';
  end if;

  insert into team_station_attempts (team_id, station_id) values (v_team_id, p_station_id);
  delete from team_offers where team_id = v_team_id;

  select s.room_name into v_room from stations s where s.id = p_station_id;
  return v_room;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 8. QR-KÓD BEOLVASÁSA (bármelyik csapattag) — itt indul az óra
-- ----------------------------------------------------------------------------

create or replace function scan_station(p_code text)
returns uuid as $$
declare
  v_team_id uuid;
  v_station_id uuid;
  v_started timestamptz;
  v_completed timestamptz;
  v_found boolean;
begin
  select p.team_id into v_team_id from profiles p where p.id = auth.uid();
  perform expire_stale_attempts(v_team_id);

  select s.id into v_station_id from stations s
  where s.qr_code = upper(trim(p_code));
  if v_station_id is null then
    raise exception 'Ismeretlen QR-kód.';
  end if;

  select true, a.started_at, a.completed_at into v_found, v_started, v_completed
  from team_station_attempts a
  where a.team_id = v_team_id and a.station_id = v_station_id;

  if v_found is null then
    raise exception 'Ez nem az az állomás, amit a kapitány választott.';
  end if;
  if v_completed is not null then
    raise exception 'Ezt az állomást már teljesítettétek.';
  end if;

  if v_started is null then
    update team_station_attempts set started_at = now()
    where team_id = v_team_id and station_id = v_station_id;
  end if;

  return v_station_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 9. A FELADAT TARTALMA — csak beolvasás után, és csak a SAJÁT töredéked
-- ----------------------------------------------------------------------------

create or replace function get_task_for_me(p_station_id uuid)
returns table (
  prompt text, my_fragment jsonb, options jsonb,
  started_at timestamptz, server_now timestamptz
) as $$
declare
  v_team_id uuid;
  v_started timestamptz;
  v_completed timestamptz;
  v_task tasks%rowtype;
  v_idx int;
  v_len int;
begin
  select p.team_id into v_team_id from profiles p where p.id = auth.uid();
  perform expire_stale_attempts(v_team_id);

  select a.started_at, a.completed_at into v_started, v_completed
  from team_station_attempts a
  where a.team_id = v_team_id and a.station_id = p_station_id;

  if v_started is null or v_completed is not null then
    raise exception 'Ez a feladat most nem érhető el.';
  end if;

  select * into v_task from tasks t where t.station_id = p_station_id;

  select r.rn into v_idx
  from (select p2.id, (row_number() over (order by p2.id) - 1) as rn
        from profiles p2 where p2.team_id = v_team_id) r
  where r.id = auth.uid();

  v_len := jsonb_array_length(v_task.fragments);

  return query
  select v_task.prompt,
         case when v_len > 0 then v_task.fragments -> (v_idx % v_len) else null end,
         (select jsonb_agg(jsonb_build_object('id', ao.id, 'label', ao.label))
          from answer_options ao where ao.task_id = v_task.id),
         v_started, now();
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 10. VÁLASZ BEKÜLDÉSE (csak kapitány) — a régi verzió cseréje
-- ----------------------------------------------------------------------------

create or replace function submit_answer(p_station_id uuid, p_option_id uuid)
returns attempt_result as $$
declare
  v_team_id uuid;
  v_is_captain boolean;
  v_attempt_id uuid;
  v_started_at timestamptz;
  v_completed_at timestamptz;
  v_result attempt_result;
  v_ingredient_id uuid;
  v_is_correct boolean;
begin
  select p.team_id, p.is_captain into v_team_id, v_is_captain
  from profiles p where p.id = auth.uid();
  if not v_is_captain then
    raise exception 'Csak a csapatkapitány küldhet be választ.';
  end if;

  select a.id, a.started_at, a.completed_at into v_attempt_id, v_started_at, v_completed_at
  from team_station_attempts a
  where a.team_id = v_team_id and a.station_id = p_station_id;

  if v_attempt_id is null or v_started_at is null then
    raise exception 'Előbb olvassátok be az állomás QR-kódját.';
  end if;
  if v_completed_at is not null then
    raise exception 'Ezt az állomást már teljesítettétek.';
  end if;

  select ao.is_correct into v_is_correct
  from answer_options ao
  join tasks t on t.id = ao.task_id
  where ao.id = p_option_id and t.station_id = p_station_id;
  if not found then
    raise exception 'Érvénytelen válaszopció.';
  end if;

  if now() - v_started_at > interval '5 minutes' then
    v_result := 'failed';
  elsif now() - v_started_at > interval '3 minutes' then
    v_result := 'stale';
  else
    v_result := 'fresh';
  end if;

  update team_station_attempts
  set completed_at = now(), chosen_option_id = p_option_id, result = v_result
  where id = v_attempt_id;

  if v_result <> 'failed' then
    select s.ingredient_id into v_ingredient_id from stations s where s.id = p_station_id;
    insert into team_inventory (team_id, ingredient_id, attempt_id, is_infected, freshness)
    values (v_team_id, v_ingredient_id, v_attempt_id, not v_is_correct, v_result);
  end if;

  return v_result;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 11. INVENTORY (a fertőzöttséget és a frissességet SOSE adja vissza)
-- ----------------------------------------------------------------------------

create or replace function get_my_inventory()
returns table (
  id uuid, ingredient_id uuid, ingredient_name text,
  room_name text, acquired_at timestamptz
) as $$
declare
  v_team_id uuid;
begin
  select p.team_id into v_team_id from profiles p where p.id = auth.uid();
  return query
  select ti.id, ti.ingredient_id, i.name, s.room_name, ti.acquired_at
  from team_inventory ti
  join ingredients i on i.id = ti.ingredient_id
  join team_station_attempts a on a.id = ti.attempt_id
  join stations s on s.id = a.station_id
  where ti.team_id = v_team_id
  order by ti.acquired_at;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 12. RITUÁLÉ BEKÜLDÉSE (csak kapitány; a határidőt a szerver adja)
-- ----------------------------------------------------------------------------

create or replace function submit_ritual(p_inventory_ids uuid[])
returns uuid as $$
declare
  v_team_id uuid;
  v_is_captain boolean;
  v_deadline timestamptz;
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
    select ao.monster into v_final_monster
    from team_inventory ti
    join team_station_attempts a on a.id = ti.attempt_id
    join answer_options ao on ao.id = a.chosen_option_id
    where ti.id = any(p_inventory_ids) and ti.team_id = v_team_id and ti.is_infected
    group by ao.monster
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

-- ----------------------------------------------------------------------------
-- 13. JÁTÉK INDÍTÁSA / VISSZAÁLLÍTÁSA (csak stáb)
-- ----------------------------------------------------------------------------

create or replace function start_game(p_gather_minutes int default 40, p_ritual_minutes int default 5)
returns void as $$
begin
  if not is_current_user_staff() then
    raise exception 'Csak a stáb indíthatja el a játékot.';
  end if;
  update game_config
  set starts_at = now(),
      ends_at = now() + make_interval(mins => p_gather_minutes),
      ritual_deadline = now() + make_interval(mins => p_gather_minutes + p_ritual_minutes)
  where id = true;
end;
$$ language plpgsql security definer set search_path = public;

-- Főpróba után: minden játékállást töröl (csapatok, kapitányok megmaradnak).
create or replace function reset_game()
returns void as $$
begin
  if not is_current_user_staff() then
    raise exception 'Csak a stáb állíthatja vissza a játékot.';
  end if;
  delete from ritual_submissions where true;
  delete from team_inventory where true;
  delete from team_station_attempts where true;
  delete from team_offers where true;
  update game_config set starts_at = null, ends_at = null, ritual_deadline = null
  where id = true;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 14. JOGOSULTSÁGOK — a kliens ne olvashasson közvetlenül érzékeny táblákat
--     (a QR-kódokat, a fertőzöttséget, a válaszokat, a többi töredéket)
-- ----------------------------------------------------------------------------

revoke select on stations, team_station_attempts, team_inventory from authenticated;

grant execute on function
  get_current_target(),
  get_routing_options(),
  choose_station(uuid),
  scan_station(text),
  get_task_for_me(uuid),
  submit_answer(uuid, uuid),
  get_my_inventory(),
  submit_ritual(uuid[]),
  start_game(int, int),
  reset_game()
to authenticated;
