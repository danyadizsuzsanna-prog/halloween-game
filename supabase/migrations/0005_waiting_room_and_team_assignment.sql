-- ============================================================================
-- 0005 — Várakozó szoba, stáb által indított kiegyensúlyozott csapatbeosztás,
--        játékosnevek, csapatnév
--
-- Új működés:
--   1. Regisztrációkor a játékos NEM kerül csapatba (team_id = null), hanem a
--      várakozó szobába. Belépés után a kliens bekéri a nevét.
--   2. A stáb egy gombbal (assign_teams) véletlenszerűen, kiegyensúlyozott
--      létszámmal osztja szét a névvel rendelkező, nem-stáb játékosokat.
--   3. A beosztás után a csapat kapitányt jelöl (claim_captain), majd a
--      kapitány csapatnevet ad (set_team_name).
--   4. Aki a beosztás UTÁN regisztrál / adja meg a nevét, automatikusan a
--      pillanatnyilag legkisebb csapatba kerül (ha ott még 8 fő alatt vagyunk;
--      különben várakozik, és a stáb a "Várakozók beosztása" gombbal dönt).
--
-- Csapatszám-szabály (plan_team_count):
--   - cél a 6 fős csapat; a csapatok kiegyensúlyozottak (legfeljebb 1 fő eltérés);
--   - egy csapatban legfeljebb 8 fő lehet, ezt a lehetőséget nem zárjuk ki:
--     ha a maradék így kisebb eltérést ad a 6-tól, 7–8 fős csapat is lehet;
--   - a csapatszám NINCS lefelé/felfelé korlátozva: az a csapatszám nyer, ahol a
--     csapatméretek összesen a legközelebb vannak a 6-hoz (döntetlennél a több,
--     kisebb csapat). Pl. 42 fő → 7×6 (nem 6×7); 37 fő → 6 csapat (5×6 + 1×7).
--
-- Futtatás: Supabase → SQL Editor → illeszd be → Run. Idempotens.
-- Előfeltétel: 0001, 0002 (és a korábban futtatott 0003/0004).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TÁBLA-MÓDOSÍTÁS
-- ----------------------------------------------------------------------------

-- Igaz, ha a kapitány már megadta a csapat nevét (addig "Csapat N" a név).
alter table teams add column if not exists name_chosen boolean not null default false;

-- Csapatonként legfeljebb egy kapitány. Ha a meglévő (teszt)adatokban egy
-- csapatnak több kapitánya van, a legrégebbit hagyjuk meg, különben az index
-- létrehozása elbukna.
update profiles p
set is_captain = false
where p.is_captain
  and p.id not in (
    select distinct on (team_id) id
    from profiles
    where is_captain and team_id is not null
    order by team_id, created_at, id
  );
update profiles set is_captain = false where is_captain and team_id is null;

create unique index if not exists one_captain_per_team
  on profiles (team_id) where is_captain;

-- FONTOS: a várakozó szobában a játékosnak még nincs csapata (team_id = null),
-- így az eddigi "own team profiles" szabály (team_id = current_team_id()) a saját
-- profilját sem engedné olvasni ("A profilod nem tölthető be"). Ezért a saját
-- profil mindig olvasható.
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for select
  using (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. REGISZTRÁCIÓ: csak profilt hozunk létre, csapatot NEM adunk
-- ----------------------------------------------------------------------------

create or replace function assign_team_on_signup()
returns trigger as $$
begin
  insert into profiles (id, email, team_id)
  values (new.id, new.email, null)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
-- (a trigger — on_auth_user_created — az 0001-ből változatlanul ezt hívja)

-- A stábtagnak nincs csapata: ha valakit stábnak jelölnek (is_staff = true),
-- automatikusan kikerül a csapatából és nem lehet kapitány.
create or replace function clear_team_for_staff()
returns trigger as $$
begin
  if new.is_staff and not coalesce(old.is_staff, false) then
    new.team_id := null;
    new.is_captain := false;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists b_staff_has_no_team on profiles;
create trigger b_staff_has_no_team
  before update of is_staff on profiles
  for each row execute function clear_team_for_staff();

-- ----------------------------------------------------------------------------
-- 3. CSAPATSZÁM-TERV
-- ----------------------------------------------------------------------------

-- A régi (négyparaméteres) változat törlése, hogy ne legyen kétértelmű hívás.
drop function if exists plan_team_count(int, int, int, int);

-- Visszaadja, hány csapatra osszuk a játékosokat: azt a k-t, amelynél a
-- kiegyensúlyozott csapatméretek összesen a legközelebb vannak a célmérethez
-- (alapból 6), úgy, hogy egy csapat sem lehet p_hard_max (8) főnél nagyobb.
-- Legalább 4 játékosnál legalább 2 csapat lesz.
create or replace function plan_team_count(
  p_players int,
  p_target int default 6,
  p_hard_max int default 8
)
returns int as $$
  select k
  from (
    select k,
           -- p_players % k csapat (q+1) fős, a többi q fős
           (p_players % k) * abs((p_players / k + 1) - p_target)
         + (k - p_players % k) * abs((p_players / k) - p_target) as cost
    from generate_series(
           greatest(ceil(p_players::numeric / p_hard_max)::int,
                    case when p_players >= 4 then 2 else 1 end),
           greatest(ceil(p_players::numeric / p_target)::int + 1, 1)
         ) as k
  ) x
  order by cost, k desc
  limit 1;
$$ language sql immutable set search_path = public;

-- ----------------------------------------------------------------------------
-- 4. BELSŐ SEGÉDEK (kliens nem hívhatja)
-- ----------------------------------------------------------------------------

-- Minden csapatot és csapathoz kötött játékállást töröl; a játékosok profilja
-- megmarad, de visszakerülnek a várakozó szobába.
create or replace function _clear_teams()
returns void as $$
begin
  update profiles set team_id = null, is_captain = false
  where team_id is not null or is_captain;
  delete from ritual_submissions where true;
  delete from team_inventory where true;
  delete from team_station_attempts where true;
  delete from team_offers where true;
  delete from teams where true;
end;
$$ language plpgsql security definer set search_path = public;

-- A beosztás után érkező (vagy a nevét később megadó) játékost a
-- pillanatnyilag legkisebb csapatba tesszük (döntetlennél véletlen) — de csak
-- akkor, ha ott még a 8 fős felső határ alatt vagyunk. Különben a játékos a
-- várakozó szobában marad, és a stáb dönt (újrakeverés, vagy a "Várakozók
-- beosztása" gomb, ami a határt figyelmen kívül hagyva a legkisebb csapatokba teszi).
create or replace function _place_late_joiner(p_user uuid, p_ignore_cap boolean default false)
returns void as $$
declare
  v_team uuid;
  v_size int;
begin
  perform pg_advisory_xact_lock(hashtext('halloween_team_assignment'));

  if not exists (
    select 1 from profiles
    where id = p_user and team_id is null and not is_staff
      and nullif(trim(coalesce(display_name, '')), '') is not null
  ) then
    return;
  end if;

  select t.id, (select count(*) from profiles p where p.team_id = t.id)
  into v_team, v_size
  from teams t
  order by (select count(*) from profiles p where p.team_id = t.id), random()
  limit 1;

  if v_team is not null and (p_ignore_cap or v_size < 8) then
    update profiles set team_id = v_team where id = p_user;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function _clear_teams() from public, anon, authenticated;
revoke execute on function _place_late_joiner(uuid, boolean) from public, anon, authenticated;
drop function if exists _place_late_joiner(uuid);

-- ----------------------------------------------------------------------------
-- 5. JÁTÉKOS: név megadása
-- ----------------------------------------------------------------------------

create or replace function set_my_display_name(p_name text)
returns void as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if length(v_name) < 2 or length(v_name) > 40 then
    raise exception 'A név legyen 2 és 40 karakter között.';
  end if;

  update profiles set display_name = v_name where id = auth.uid();
  if not found then
    raise exception 'A profilod nem található.';
  end if;

  -- Ha a beosztás már megtörtént, azonnal csapatot kap.
  perform _place_late_joiner(auth.uid());
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 6. STÁB: csapatok kialakítása
-- ----------------------------------------------------------------------------

create or replace function assign_teams(p_force boolean default false)
returns jsonb as $$
declare
  v_n int;
  v_k int;
  v_cap int;
  v_sizes jsonb;
begin
  if not is_current_user_staff() then
    raise exception 'Csak a stáb oszthatja be a csapatokat.';
  end if;

  perform pg_advisory_xact_lock(hashtext('halloween_team_assignment'));

  if exists (select 1 from teams) then
    if not p_force then
      raise exception 'Már vannak csapatok. Újrakeveréshez használd az "Újrakeverés" gombot.';
    end if;
    if exists (select 1 from game_config where starts_at is not null) then
      raise exception 'A játék már elindult — a beosztás nem módosítható. Előbb állítsd vissza a játékot.';
    end if;
    perform _clear_teams();
  end if;

  select count(*) into v_n
  from profiles
  where not is_staff and nullif(trim(coalesce(display_name, '')), '') is not null;

  if v_n < 2 then
    raise exception 'Legalább 2 játékos kell a beosztáshoz (most: %).', v_n;
  end if;

  v_k := plan_team_count(v_n);
  v_cap := ceil(v_n::numeric / v_k)::int;

  with new_teams as (
    insert into teams (name, capacity)
    select 'Csapat ' || g, v_cap from generate_series(1, v_k) g
    returning id, name
  ),
  numbered_teams as (
    select id, (substring(name from '\d+')::int - 1) as idx from new_teams
  ),
  shuffled as (
    select id, ((row_number() over (order by random())) - 1) % v_k as idx
    from profiles
    where not is_staff and nullif(trim(coalesce(display_name, '')), '') is not null
  )
  update profiles p
  set team_id = nt.id
  from shuffled s
  join numbered_teams nt on nt.idx = s.idx
  where p.id = s.id;

  select jsonb_agg(c order by c desc) into v_sizes
  from (select count(*) as c from profiles where team_id is not null group by team_id) x;

  return jsonb_build_object('players', v_n, 'teams', v_k, 'sizes', v_sizes);
end;
$$ language plpgsql security definer set search_path = public;

-- Beosztás törlése (mindenki visszakerül a várakozó szobába). Csak ha a játék
-- még nem indult el.
create or replace function reset_team_assignment()
returns void as $$
begin
  if not is_current_user_staff() then
    raise exception 'Csak a stáb törölheti a beosztást.';
  end if;
  perform pg_advisory_xact_lock(hashtext('halloween_team_assignment'));
  if exists (select 1 from game_config where starts_at is not null) then
    raise exception 'A játék már elindult — előbb állítsd vissza a játékot.';
  end if;
  perform _clear_teams();
end;
$$ language plpgsql security definer set search_path = public;

-- Csapat nélkül maradt (névvel rendelkező) játékosok beosztása a legkisebb
-- csapatokba, a 8 fős felső határt figyelmen kívül hagyva. Játék közben is
-- használható.
create or replace function place_waiting_players()
returns int as $$
declare
  r record;
  v_left int;
begin
  if not is_current_user_staff() then
    raise exception 'Csak a stáb oszthat be játékosokat.';
  end if;
  if not exists (select 1 from teams) then
    raise exception 'Még nincsenek csapatok — használd a "Csapatok kialakítása" gombot.';
  end if;
  for r in
    select id from profiles
    where not is_staff and team_id is null
      and nullif(trim(coalesce(display_name, '')), '') is not null
    order by random()
  loop
    perform _place_late_joiner(r.id, true);
  end loop;
  select count(*) into v_left from profiles
  where not is_staff and team_id is null
    and nullif(trim(coalesce(display_name, '')), '') is not null;
  return v_left;
end;
$$ language plpgsql security definer set search_path = public;

-- Stáb-áttekintő: várakozók, csapatok tagjaival, és a terv az aktuális létszámra.
create or replace function staff_get_overview()
returns jsonb as $$
declare
  v_named int;
  v_k int;
begin
  if not is_current_user_staff() then
    raise exception 'Csak a stáb láthatja.';
  end if;

  select count(*) into v_named
  from profiles
  where not is_staff and nullif(trim(coalesce(display_name, '')), '') is not null;

  v_k := case when v_named >= 1 then plan_team_count(v_named) else 0 end;

  return jsonb_build_object(
    'game_started', exists (select 1 from game_config where starts_at is not null),
    'teams_exist', exists (select 1 from teams),
    'named_players', v_named,
    'unnamed_players', (
      select count(*) from profiles
      where not is_staff and nullif(trim(coalesce(display_name, '')), '') is null
    ),
    'staff_count', (select count(*) from profiles where is_staff),
    'plan', jsonb_build_object(
      'teams', v_k,
      'min_size', case when v_k > 0 then v_named / v_k else 0 end,
      'max_size', case when v_k > 0 then ceil(v_named::numeric / v_k)::int else 0 end
    ),
    'waiting', coalesce((
      select jsonb_agg(display_name order by created_at)
      from profiles
      where not is_staff and team_id is null
        and nullif(trim(coalesce(display_name, '')), '') is not null
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'name_chosen', t.name_chosen,
          'members', (
            select coalesce(jsonb_agg(
              jsonb_build_object('name', coalesce(nullif(p.display_name, ''), 'Névtelen'),
                                 'is_captain', p.is_captain)
              order by p.is_captain desc, p.display_name), '[]'::jsonb)
            from profiles p where p.team_id = t.id
          )
        )
        order by substring(t.name from '\d+')::int nulls last, t.name
      )
      from teams t
    ), '[]'::jsonb)
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 7. JÁTÉKOS: várakozó szoba, csapattagok (email NÉLKÜL)
-- ----------------------------------------------------------------------------

create or replace function get_waiting_room()
returns jsonb as $$
  select jsonb_build_object(
    'count', (select count(*) from profiles
              where not is_staff and team_id is null
                and nullif(trim(coalesce(display_name, '')), '') is not null),
    'players', coalesce((
      select jsonb_agg(display_name order by created_at)
      from profiles
      where not is_staff and team_id is null
        and nullif(trim(coalesce(display_name, '')), '') is not null
    ), '[]'::jsonb)
  );
$$ language sql security definer stable set search_path = public;

create or replace function get_my_team_members()
returns table (id uuid, display_name text, is_captain boolean, is_me boolean) as $$
  select p.id,
         coalesce(nullif(p.display_name, ''), 'Névtelen') as display_name,
         p.is_captain,
         p.id = auth.uid() as is_me
  from profiles p
  where p.team_id is not null
    and p.team_id = (select m.team_id from profiles m where m.id = auth.uid())
  order by p.is_captain desc, p.display_name;
$$ language sql security definer stable set search_path = public;

-- ----------------------------------------------------------------------------
-- 8. KAPITÁNY ÉS CSAPATNÉV
-- ----------------------------------------------------------------------------

-- Zárolt változat: egyszerre két kattintás sem adhat két kapitányt.
create or replace function claim_captain(p_team_id uuid)
returns void as $$
begin
  perform pg_advisory_xact_lock(hashtext('captain:' || p_team_id::text));

  if not exists (
    select 1 from profiles
    where id = auth.uid() and team_id = p_team_id and not is_staff
  ) then
    raise exception 'Nem vagy tagja ennek a csapatnak.';
  end if;

  if exists (select 1 from profiles where team_id = p_team_id and is_captain) then
    raise exception 'A csapatnak már van kapitánya.';
  end if;

  update profiles set is_captain = true where id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;

create or replace function set_team_name(p_name text)
returns void as $$
declare
  v_team uuid;
  v_captain boolean;
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  select team_id, is_captain into v_team, v_captain from profiles where id = auth.uid();
  if v_team is null or not coalesce(v_captain, false) then
    raise exception 'Csak a kapitány adhat nevet a csapatnak.';
  end if;

  if length(v_name) < 2 or length(v_name) > 30 then
    raise exception 'A csapatnév legyen 2 és 30 karakter között.';
  end if;

  perform pg_advisory_xact_lock(hashtext('halloween_team_name'));

  if exists (select 1 from teams where id <> v_team and lower(name) = lower(v_name)) then
    raise exception 'Ezt a nevet már egy másik csapat használja — válasszatok mást!';
  end if;

  if exists (select 1 from ritual_submissions where team_id = v_team) then
    raise exception 'A rituálé beküldése után már nem lehet átnevezni a csapatot.';
  end if;

  update teams set name = v_name, name_chosen = true where id = v_team;
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 9. JOGOSULTSÁGOK
-- ----------------------------------------------------------------------------

revoke execute on function
  plan_team_count(int, int, int),
  set_my_display_name(text),
  assign_teams(boolean),
  reset_team_assignment(),
  place_waiting_players(),
  staff_get_overview(),
  get_waiting_room(),
  get_my_team_members(),
  claim_captain(uuid),
  set_team_name(text)
from public, anon;

grant execute on function
  plan_team_count(int, int, int),
  set_my_display_name(text),
  assign_teams(boolean),
  reset_team_assignment(),
  place_waiting_players(),
  staff_get_overview(),
  get_waiting_room(),
  get_my_team_members(),
  claim_captain(uuid),
  set_team_name(text)
to authenticated;

notify pgrst, 'reload schema';
