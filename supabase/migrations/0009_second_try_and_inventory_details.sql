-- ============================================================================
-- 0009 — (PO 2026-11-04, a 0008 részleges visszaállítása)
--
-- 1. Az irányajánló újra felajánl olyan állomást is, amelynek alapanyaga már
--    megvan a csapatnál (második próbálkozás a másik állomáson).
--    Szabályok (az eredeti működés):
--      - rendes állomás: bármelyik, ahol a csapat még nem járt (az utolsó 10
--        percben csak a még hiányzó alapanyagokhoz tartozók);
--      - tartalék állomás: csak az utolsó 10 percben, csak ha az alapanyag
--        hiányzik, és mindkét rendes állomásán már jártak;
--      - a 0008 többi szabálya marad: csak szabad helyszín, szabadból max. 2,
--        ha nincs szabad, 1 várakozós a várakozási idővel, foglalt nem
--        választható.
-- 2. A rituálé-összeállításhoz a leltár megadja minden példányhoz a feladat
--    címét (ha nincs címe, a szövegének első sorát rövidítve) és a csapat beírt
--    válaszát, valamint a kérdés teljes szövegét (a helyességet és a frissességet NEM).
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
      -- rendes állomás: bármikor; az utolsó 10 percben csak hiányzó alapanyaghoz
      (s.kind = 'primary'
        and (now() <= p_ends - interval '10 minutes'
             or s.ingredient_id not in (select m.ingredient_id from mine m)))
      or
      -- tartalék: csak az utolsó 10 percben, hiányzó alapanyaghoz, ha a rendes
      -- állomásokon már jártak
      (s.kind = 'backup'
        and now() > p_ends - interval '10 minutes'
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
-- Leltár: példányonként a feladat címe és a csapat beírt válasza
-- ----------------------------------------------------------------------------
drop function if exists get_my_inventory();

create function get_my_inventory()
returns table (
  id uuid, ingredient_id uuid, ingredient_name text,
  room_name text, acquired_at timestamptz,
  task_title text, given_answer text, task_prompt text
) as $$
declare
  v_team_id uuid;
begin
  select p.team_id into v_team_id from profiles p where p.id = auth.uid();
  return query
  select ti.id, ti.ingredient_id, i.name, s.room_name, ti.acquired_at,
         coalesce(
           nullif(trim(t.title), ''),
           left(split_part(t.prompt, E'\n', 1), 40)
             || case when length(split_part(t.prompt, E'\n', 1)) > 40 then '…' else '' end
         ),
         a.given_answer,
         t.prompt
  from team_inventory ti
  join ingredients i on i.id = ti.ingredient_id
  join team_station_attempts a on a.id = ti.attempt_id
  join stations s on s.id = a.station_id
  left join tasks t on t.station_id = s.id
  where ti.team_id = v_team_id
  order by ti.acquired_at;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function get_my_inventory() from public, anon;
grant execute on function get_my_inventory() to authenticated;

notify pgrst, 'reload schema';
