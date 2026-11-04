# Éjszakai Rituálé — Halloween csapatépítő játék

Céges csapatépítő PWA, ~45–60 fő, egyszeri esemény: **2026. november 5.**

**Stack:** React + Vite (PWA) + Tailwind + Supabase (Postgres, Auth, RLS, SECURITY DEFINER függvények). Nincs saját szerver; minden játéklogika Postgres függvényekben fut. Kiadás: GitHub Pages (`.github/workflows/build.yml`).

## Játékmenet röviden
1. Mindenki regisztrál (email + 6 jegyű PIN), megadja a nevét, és a **várakozó szobába** kerül.
2. A **stáb egy gombbal** véletlen, kiegyensúlyozott csapatokat alakít (cél: 6 fő, legfeljebb 8).
3. A csapat **kapitányt** választ; a kapitány adja meg a **csapatnevet**.
4. A stáb a `/presenter` oldalon elindítja a játékot. A kapitány irányt választ, a csapat megkeresi az állomás **QR-kódját**, beolvassa, és **mindenki ugyanazt a teljes feladatot látja**. A kapitány **beírja** a választ (5 perc; 3 perc után az alapanyag romlani kezd).
5. Rossz válasz = „fertőzött” alapanyag; a rituálé végén véletlenszerű szörny jelenik meg. A hat alapanyagból a kapitány beküldi a rituálét, a kivetítőn (`/presenter`) csapatonként lejátszódik a végkifejlet-videó, majd a dobogó.

## Felépítés
- `src/` — a kliens (oldalak: `pages/`, a kivetítős jelenet: `components/RitualStage.jsx`)
- `public/` — képek, ikonok, a feladat-videók (`feladatok/`) és a rituálé-videók (`ritual/`)
- `supabase/migrations/` — az adatbázis-séma (0001, 0002, 0004, 0005, 0008). A feladatok **helyes válaszai és a QR-kódok** szándékosan NINCSENEK a repóban; ezeket csak a Supabase SQL Editorba kell bemásolni.

## Beállítások (egyszer, már megvannak)
- GitHub: Settings → Pages → Source: *GitHub Actions*; Settings → Secrets and variables → Actions: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Supabase: Authentication → URL Configuration: a site címe (`https://<felhasználó>.github.io/<repo>/**`).

## Fontos
- **Ne kerüljön a nyilvános repóba:** a feladatok válaszai, a QR-kódok, a `supabase/seed/` mappa.
- Új feladat- vagy QR-módosítás: SQL Editorban fut, nem a repón keresztül.
