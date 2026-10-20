-- 0004 — Rituálé-lejátszás a kivetítőhöz
--
-- A TV-s Presenter nézetnek tudnia kell, mely alapanyagok kerültek a beküldött
-- rituáléba (és mennyire voltak frissek), hogy a lejátszás során sorban az
-- üstbe hullhassanak. A team_inventory táblára közvetlen SELECT nincs
-- (a csapatok nem láthatják a "fertőzött" jelölést), ezért ezt egy kizárólag
-- stáb-tagoknak szóló függvény adja ki.
--
-- FONTOS: a függvény SZÁNDÉKOSAN nem ad vissza fertőzött-jelölést vagy
-- szörny-típust alapanyag szinten — csak a végeredmény (final_monster) jön
-- vissza, azt is csak a stáb láthatja.
--
-- Futtatás: Supabase → SQL Editor → illeszd be → Run.
-- Idempotens, újra is futtatható.

create or replace function get_ritual_showcase()
returns jsonb as $$
begin
  if not is_current_user_staff() then
    raise exception 'Csak a stáb nézheti meg a rituálé-lejátszást.';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.submitted_at)
    from (
      select
        r.id,
        t.name as team_name,
        r.submitted_at,
        r.is_complete,
        r.final_monster,
        r.freshness_score,
        coalesce((
          select jsonb_agg(
                   jsonb_build_object(
                     'slug', i.slug,
                     'name', i.name,
                     'freshness', ti.freshness::text
                   )
                   order by i.slug
                 )
          from team_inventory ti
          join ingredients i on i.id = ti.ingredient_id
          where ti.id = any(r.used_inventory_ids)
        ), '[]'::jsonb) as ingredients
      from ritual_submissions r
      join teams t on t.id = r.team_id
    ) x
  ), '[]'::jsonb);
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function get_ritual_showcase() from public, anon;
grant execute on function get_ritual_showcase() to authenticated;

-- A PostgREST sémagyorsítótár frissítése, hogy az új függvény azonnal elérhető legyen.
notify pgrst, 'reload schema';
