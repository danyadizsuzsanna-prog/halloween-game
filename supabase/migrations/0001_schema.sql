-- ============================================================================
-- Éjszakai Rituálé — teljes adatmodell
-- Egyszeri céges csapatépítő esemény (2026-10-20), ~45-60 fő, 5-6 fős csapatok
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. CSAPATOK ÉS JÁTÉKOSOK
-- ----------------------------------------------------------------------------

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity int not null default 6,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  team_id uuid references teams(id),
  is_captain boolean not null default false,
  is_staff boolean not null default false, -- kézzel állítandó true-ra a stáb tagjainak
  created_at timestamptz not null default now()
);

-- Amikor valaki első alkalommal regisztrál (email alapján), automatikusan
-- betesszük egy csapatba: az első nem-teli csapatba, vagy ha nincs ilyen,
-- nyitunk egy újat. Ez valósítja meg a "fix csapatméret, rugalmas
-- csapatszám" szabályt.
create or replace function assign_team_on_signup()
returns trigger as $$
declare
  target_team_id uuid;
  team_count int;
begin
  select id into target_team_id
  from teams t
  where (select count(*) from profiles p where p.team_id = t.id) < t.capacity
  order by t.created_at asc
  limit 1;

  if target_team_id is null then
    select count(*) into team_count from teams;
    insert into teams (name, capacity)
    values ('Csapat ' || (team_count + 1), 6)
    returning id into target_team_id;
  end if;

  insert into profiles (id, email, team_id)
  values (new.id, new.email, target_team_id);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function assign_team_on_signup();

-- Kapitány-jelölés: csak akkor sikeres, ha a csapatnak MÉG NINCS kapitánya.
-- (A "kapitány fix, nincs automatikus átadás" szabályt a hiányzó UPDATE-jog
-- kényszeríti ki lejjebb, RLS szinten.)
create or replace function claim_captain(p_team_id uuid)
returns void as $$
begin
  if exists (select 1 from profiles where team_id = p_team_id and is_captain = true) then
    raise exception 'A csapatnak már van kapitánya.';
  end if;
  update profiles set is_captain = true
  where id = auth.uid() and team_id = p_team_id;
end;
$$ language plpgsql security definer;

-- Egy sorban tárolt globális esemény-időzítés (gyűjtögető fázis vége).
-- Az admin (staff) állítja be az esemény napján, indításkor.
create table game_config (
  id boolean primary key default true check (id),
  starts_at timestamptz,
  ends_at timestamptz -- gyűjtögető fázis vége (submission deadline is ez)
);
insert into game_config (id, starts_at, ends_at) values (true, null, null);

alter table game_config enable row level security;
create policy "config readable" on game_config for select using (true);

-- Csak stáb-tag indíthatja el az órát (event napján, élőben).
create or replace function start_game(p_duration_minutes int default 45)
returns void as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_staff = true) then
    raise exception 'Csak a stáb indíthatja el a játékot.';
  end if;
  update game_config
  set starts_at = now(), ends_at = now() + (p_duration_minutes || ' minutes')::interval
  where id = true;
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- 2. ALAPANYAGOK, ÁLLOMÁSOK, FELADATOK
-- ----------------------------------------------------------------------------

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

insert into ingredients (slug, name) values
  ('boszorkanygyoker', 'Boszorkánygyökér'),
  ('ezustpor', 'Ezüstpor'),
  ('obszidianszilank', 'Obszidiánszilánk'),
  ('szellembogyo', 'Szellembogyó'),
  ('arnyekgomba', 'Árnyékgomba'),
  ('hollokonny', 'Hollókönny');

create type station_kind as enum ('primary', 'backup');

create table stations (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id),
  kind station_kind not null,
  room_name text not null,
  qr_code text not null unique
);

create type monster_type as enum ('vampire', 'ghost', 'werewolf');

create table tasks (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null unique references stations(id),
  prompt text not null,
  -- Az 5 (max 6) egyéni infó-fragmentum, amit a csapattagok külön-külön látnak.
  -- Formátum: [{"role": "1. fő", "text": "..."}, ...]
  fragments jsonb not null default '[]'::jsonb,
  has_physical_prop boolean not null default false
);

create table answer_options (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  monster monster_type -- null, ha is_correct = true
);

-- ----------------------------------------------------------------------------
-- 3. PRÓBÁLKOZÁSOK, INVENTORY, RITUÁLÉ
-- ----------------------------------------------------------------------------

create type attempt_result as enum ('pending', 'fresh', 'stale', 'failed');

create table team_station_attempts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  station_id uuid not null references stations(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  chosen_option_id uuid references answer_options(id),
  result attempt_result not null default 'pending',
  unique (team_id, station_id) -- egy állomásra egy csapat csak egyszer mehet
);

-- Csak akkor kerül be az inventorybe, ha az attempt result = 'fresh' vagy 'stale'
-- (romlott / sikertelen SOHA nem kerül be — lásd submit_answer() lejjebb).
create table team_inventory (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  ingredient_id uuid not null references ingredients(id),
  attempt_id uuid not null references team_station_attempts(id),
  is_infected boolean not null,
  freshness attempt_result not null, -- 'fresh' vagy 'stale'
  acquired_at timestamptz not null default now()
);

create table ritual_submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references teams(id),
  submitted_at timestamptz not null default now(),
  used_inventory_ids uuid[] not null,
  is_complete boolean not null, -- van mind a 6 alapanyag, vagy hiányos ("nem sikerült")
  final_monster monster_type, -- null, ha tiszta siker vagy hiányos
  freshness_score numeric -- csak sikeres, tiszta rituáléknál számít a dobogóhoz
);

-- ----------------------------------------------------------------------------
-- 4. SZERVER-OLDALI VÁLASZ-BEKÜLDÉS (a kliens SOHA nem tudja előre a helyes
--    választ vagy a szörny-mappinget — csak a beküldés UTÁN, a válaszból)
-- ----------------------------------------------------------------------------

-- FONTOS: az óra akkor induljon, amikor a csapat MEGNYITJA a feladatot, nem
-- akkor, amikor beküldi a választ — különben a 3+2 perces romlási mechanika
-- értelmét veszti (mindig "fresh" lenne). Bármelyik csapattag hívhatja
-- (nem csak a kapitány), amint megjelenik a Task képernyőn. Idempotens: ha
-- már van attempt erre az állomásra, nem csinál semmit.
create or replace function start_attempt(p_station_id uuid)
returns void as $$
declare
  v_team_id uuid;
begin
  select team_id into v_team_id from profiles where id = auth.uid();
  insert into team_station_attempts (team_id, station_id, started_at)
  values (v_team_id, p_station_id, now())
  on conflict (team_id, station_id) do nothing;
end;
$$ language plpgsql security definer;

create or replace function submit_answer(p_station_id uuid, p_option_id uuid)
returns attempt_result as $$
declare
  v_team_id uuid;
  v_is_captain boolean;
  v_started_at timestamptz;
  v_completed_at timestamptz;
  v_elapsed interval;
  v_result attempt_result;
  v_ingredient_id uuid;
  v_is_correct boolean;
  v_monster monster_type;
begin
  select team_id, is_captain into v_team_id, v_is_captain
  from profiles where id = auth.uid();

  if not v_is_captain then
    raise exception 'Csak a csapatkapitány küldhet be választ.';
  end if;

  select started_at, completed_at into v_started_at, v_completed_at
  from team_station_attempts
  where team_id = v_team_id and station_id = p_station_id;

  if v_completed_at is not null then
    raise exception 'Ezt az állomást már teljesítettétek.';
  end if;

  if v_started_at is null then
    -- Védőháló: elvileg a Task képernyő már meghívta a start_attempt()-et
    -- megnyitáskor. Ha valamiért mégsem (pl. hálózati hiba), itt indul el
    -- az óra MOST — ez azt jelenti, hogy ilyenkor a válasz mindig "fresh"
    -- lesz, mert nincs korábbi időpont, amihez képest mérni lehetne.
    insert into team_station_attempts (team_id, station_id, started_at)
    values (v_team_id, p_station_id, now())
    returning started_at into v_started_at;
  end if;

  v_elapsed := now() - v_started_at;

  if v_elapsed > interval '5 minutes' then
    v_result := 'failed';
  elsif v_elapsed > interval '3 minutes' then
    v_result := 'stale';
  else
    v_result := 'fresh';
  end if;

  select ingredient_id into v_ingredient_id from stations where id = p_station_id;
  select is_correct, monster into v_is_correct, v_monster
  from answer_options where id = p_option_id;

  update team_station_attempts
  set completed_at = now(), chosen_option_id = p_option_id, result = v_result
  where team_id = v_team_id and station_id = p_station_id;

  if v_result <> 'failed' then
    insert into team_inventory (team_id, ingredient_id, attempt_id, is_infected, freshness)
    select v_team_id, v_ingredient_id, tsa.id, not v_is_correct, v_result
    from team_station_attempts tsa
    where tsa.team_id = v_team_id and tsa.station_id = p_station_id;
  end if;

  return v_result;
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- 5. ÚTVONAL-AJÁNLÓ (torlódás-elosztás)
--    Az utolsó 10 percben csak a hiányzó alapanyagokat ajánlja, egyébként
--    bármelyik még nem látogatott állomást. Foglaltnak számít egy állomás,
--    ha van rajta egy MÁSIK csapat "pending" (el nem küldött) próbálkozása.
-- ----------------------------------------------------------------------------

create or replace function get_routing_options(p_game_ends_at timestamptz)
returns table (
  station_id uuid,
  ingredient_name text,
  room_name text,
  is_backup boolean,
  is_busy boolean,
  busy_seconds_left int
) as $$
declare
  v_team_id uuid;
  v_last_10 boolean;
begin
  select team_id into v_team_id from profiles where id = auth.uid();
  v_last_10 := now() > (p_game_ends_at - interval '10 minutes');

  return query
  with visited as (
    select tsa.station_id from team_station_attempts tsa where tsa.team_id = v_team_id
  ),
  have_ingredient as (
    select ti.ingredient_id from team_inventory ti where ti.team_id = v_team_id
  ),
  candidates as (
    select s.id as station_id, i.name as ingredient_name, s.room_name,
           (s.kind = 'backup') as is_backup,
           s.ingredient_id
    from stations s
    join ingredients i on i.id = s.ingredient_id
    where s.id not in (select v.station_id from visited v)
      and (
        not v_last_10
        or s.ingredient_id not in (select ingredient_id from have_ingredient)
      )
  ),
  occupancy as (
    select st.station_id,
           extract(epoch from (started_at + interval '5 minutes' - now()))::int as seconds_left
    from team_station_attempts st
    where st.completed_at is null and st.team_id <> v_team_id
  )
  select c.station_id, c.ingredient_name, c.room_name, c.is_backup,
         (o.station_id is not null) as is_busy,
         o.seconds_left
  from candidates c
  left join occupancy o on o.station_id = c.station_id
  order by (o.station_id is not null) asc, random()
  limit 2;
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- 6. RITUÁLÉ BEKÜLDÉSE (csak kapitány, csak időn belül)
-- ----------------------------------------------------------------------------

create or replace function submit_ritual(p_inventory_ids uuid[], p_deadline timestamptz)
returns uuid as $$
declare
  v_team_id uuid;
  v_is_captain boolean;
  v_is_complete boolean;
  v_final_monster monster_type;
  v_freshness_score numeric;
  v_submission_id uuid;
  v_ingredient_count int;
  v_infected_count int;
  v_dominant record;
begin
  select team_id, is_captain into v_team_id, v_is_captain from profiles where id = auth.uid();
  if not v_is_captain then
    raise exception 'Csak a kapitány küldheti be a rituálét.';
  end if;
  if now() > p_deadline then
    raise exception 'Lejárt az idő, a rituálé már nem küldhető be.';
  end if;

  select count(distinct ingredient_id) into v_ingredient_count
  from team_inventory where id = any(p_inventory_ids) and team_id = v_team_id;

  v_is_complete := (v_ingredient_count = 6);

  select count(*) into v_infected_count
  from team_inventory where id = any(p_inventory_ids) and team_id = v_team_id and is_infected;

  if v_is_complete and v_infected_count > 0 then
    -- domináns szörny: melyik szörnytípusból volt a legtöbb a fertőzött
    -- elemek beküldött válaszopciói között; döntetlennél véletlen.
    select ao.monster into v_dominant
    from team_inventory ti
    join team_station_attempts tsa on tsa.id = ti.attempt_id
    join answer_options ao on ao.id = tsa.chosen_option_id
    where ti.id = any(p_inventory_ids) and ti.team_id = v_team_id and ti.is_infected
    group by ao.monster
    order by count(*) desc, random()
    limit 1;
    v_final_monster := v_dominant.monster;
  elsif not v_is_complete then
    v_final_monster := null; -- "Ez most sajnos nem sikerült" kimenet
  end if;

  if v_is_complete and v_infected_count = 0 then
    select avg(case when freshness = 'fresh' then 1.0 else 0.5 end) into v_freshness_score
    from team_inventory where id = any(p_inventory_ids) and team_id = v_team_id;
  end if;

  insert into ritual_submissions
    (team_id, used_inventory_ids, is_complete, final_monster, freshness_score)
  values (v_team_id, p_inventory_ids, v_is_complete, v_final_monster, v_freshness_score)
  returning id into v_submission_id;

  return v_submission_id;
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
--    Mindenki csak a saját csapata adatait látja; válasz beküldése és
--    rituálé-beküldés kizárólag a kapitánynak engedélyezett a fenti
--    SECURITY DEFINER függvényeken keresztül, NEM közvetlen táblaírással.
-- ----------------------------------------------------------------------------

-- Fontos RLS-csapda elkerülése: egy policy, ami a SAJÁT táblájára hivatkozik
-- vissza egy sima subqueryvel ("infinite recursion detected in policy"),
-- könnyen végtelen rekurzióba fut Postgres-ben. A szokásos megoldás: egy
-- SECURITY DEFINER helper függvény, ami megkerüli az RLS-t a belső lekérdezésnél.
create or replace function current_team_id()
returns uuid as $$
  select team_id from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function is_current_user_staff()
returns boolean as $$
  select coalesce(is_staff, false) from profiles where id = auth.uid();
$$ language sql security definer stable;

alter table profiles enable row level security;
alter table teams enable row level security;
alter table team_station_attempts enable row level security;
alter table team_inventory enable row level security;
alter table ritual_submissions enable row level security;
alter table stations enable row level security;
alter table tasks enable row level security;
alter table answer_options enable row level security;
alter table ingredients enable row level security;

create policy "own team profiles" on profiles for select
  using (team_id = current_team_id());

create policy "own team row" on teams for select
  using (id = current_team_id());

create policy "own team attempts" on team_station_attempts for select
  using (team_id = current_team_id());

create policy "own team inventory" on team_inventory for select
  using (team_id = current_team_id());

create policy "own team ritual" on ritual_submissions for select
  using (team_id = current_team_id());

-- A stáb (is_staff) mindent lát — ez hajtja a TV-prezenter nézetet.
create policy "staff sees all ritual" on ritual_submissions for select
  using (is_current_user_staff());

create policy "staff sees all teams" on teams for select
  using (is_current_user_staff());

create policy "staff sees all profiles" on profiles for select
  using (is_current_user_staff());

create policy "stations readable" on stations for select using (true);
create policy "ingredients readable" on ingredients for select using (true);

-- FONTOS: a tasks/answer_options tábláknál a helyes válasz és a szörny-mapping
-- SOHA nem megy ki a kliensnek előre. A kliens csak a prompt + fragments +
-- label mezőket kapja (lásd nézetek lejjebb), a helyesség kiderítése kizárólag
-- a submit_answer() RPC-n keresztül történik.

create view public_tasks as
  select id, station_id, prompt, fragments, has_physical_prop from tasks;

create view public_answer_options as
  select id, task_id, label from answer_options; -- is_correct, monster NINCS benne

-- ----------------------------------------------------------------------------
-- JOGOSULTSÁGOK (GRANT)
-- 2026. május 30. óta az új Supabase projektekben a public séma új táblái
-- NEM érhetők el automatikusan az API-n át, ezért mindent kifejezetten
-- engedélyezünk. Táblákra csak OLVASÁS jár; minden írás a SECURITY DEFINER
-- függvényeken keresztül történik. Az RLS szabályok ettől függetlenül élnek.
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on
  profiles, teams, ingredients, stations, game_config,
  team_station_attempts, team_inventory, ritual_submissions
to authenticated;

grant select on public_tasks, public_answer_options to authenticated;

grant execute on function
  current_team_id(),
  is_current_user_staff(),
  claim_captain(uuid),
  start_attempt(uuid),
  submit_answer(uuid, uuid),
  get_routing_options(timestamptz),
  submit_ritual(uuid[], timestamptz),
  start_game(int)
to authenticated;

-- Nincs semmilyen direkt insert/update/delete policy a fenti táblákra a
-- kliens (authenticated) role számára — minden írás a SECURITY DEFINER
-- függvényeken (submit_answer, submit_ritual, claim_captain) keresztül megy,
-- amik a kapitány-ellenőrzést szerver oldalon kényszerítik ki.
