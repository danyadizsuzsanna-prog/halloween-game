# Éjszakai Rituálé — Halloween Game Studio

Céges csapatépítő PWA, ~45-60 fő, 5-6 fős csapatok, egyszeri esemény: **2026. október 20.**

## Fontos — mielőtt bármit csinálnál

Ez a kódbázis egy Claude-sandboxban készült, ahol **nincs internet-hozzáférés**.
Ez azt jelenti:
- Nem futott le `npm install` — a függőségek listázva vannak a `package.json`-ban,
  de nincsenek letöltve/tesztelve.
- Nincs élő Supabase projekt — a `supabase/migrations/0001_schema.sql` és a
  `supabase/seed/seed_data.sql` még sosem futott le valódi adatbázison.
- A build (`npm run build`) és a dev szerver (`npm run dev`) még nem lett
  kipróbálva.

**Tehát: ez egy alapos, végiggondolt vázlat, nem egy tesztelt, éles rendszer.**
Mielőtt bárkit ráengedtek, mindenképp fusson le rajta a QA & Security kör
(lásd lent), és egy éles főpróba a saját gépeteken/Supabase projeteteken.

## Gyors indulás

```bash
npm install
cp .env.example .env      # töltsd ki a saját Supabase URL-eddel és anon key-eddel
npm run dev
```

### Supabase projekt felállítása

1. Hozz létre egy új projektet a [supabase.com](https://supabase.com) oldalon.
2. Az SQL Editorban futtasd le sorban:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/seed/seed_data.sql`
3. Authentication → Providers → Email: engedélyezd a "magic link" (OTP) módot,
   jelszó nélkül.
4. Állítsd be a saját céges email-domain szűrést, ha csak bizonyos domainről
   szeretnétek beengedni embereket (Auth → Email templates / Auth Hooks).
5. A stáb tagjainak (akik a `/presenter` nézetet fogják használni) az esemény
   előtt kézzel állítsd `is_staff = true`-ra a `profiles` táblában, miután
   először beléptek egyszer emaillel.

### QR-kódok legyártása

```bash
cd scripts
npm install qrcode
node generate_qr_codes.mjs
```

Ez legenerálja mind a 18 QR-kódot (`RITUAL-01`…`RITUAL-18`) PNG-ként,
nyomtatásra készen. Ragaszd ki őket a lenti térkép szerint.

## Fizikai állomás-térkép (jóváhagyott)

| Alapanyag | 1. állomás | 2. állomás | Tartalék |
|---|---|---|---|
| Boszorkánygyökér | Raktár | Teakonyha | A4 |
| Ezüstpor | Elnöki tárgyaló | Digi | Kistárgyaló 1 |
| Obszidiánszilánk | Kreak | A2 | Irodavezető |
| Szellembogyó | Étkező | A1 | Kistárgyaló 2 |
| Árnyékgomba | Billiárd | Kék kanapé | Étkező |
| Hollókönny | DTP | A3 | Bejárat |

**Tiltott zónák (nincs bennük állomás):** SPECIAL, Gergő irodája, Kazi/Korn
irodája, Zsófi irodája, Pénzügy/HR irodák.

Az `Étkező` két zugot ad (Szellembogyó 1. állomás + Árnyékgomba tartalék) —
a fizikai kihelyezésnél ügyelj rá, hogy a két állomás jól elkülönüljön
egymástól (más asztal/sarok), hogy a csapatok ne zavarják egymást.

## Játékmenet — rövid összefoglaló

- Email-alapú belépés (magic link), automatikus csapatba sorolás (fix 5-6 fő,
  a csapatok száma igazodik a tényleges létszámhoz).
- Egy csapatkapitány (fix egész játékra, elsőként jelentkező) küldheti be a
  válaszokat és a végső rituálét — ezt adatbázis-szintű jogosultság (RLS +
  SECURITY DEFINER függvények) kényszeríti ki, nem csak a UI.
- 18 feladat (12 rendes + 6 tartalék), mindegyik 5 egyéni infó-fragmensre
  bomlik, a válaszopciók sorrendje mindig véletlenszerű.
- A helyes/helytelen válasz + a szörny-hozzárendelés **soha nem megy ki**
  a kliensnek előre — csak a `submit_answer()` szerver-oldali függvényen
  keresztül derül ki, beküldés után.
- Feladatonkénti időzítés: 0-3 perc friss, 3-5 perc "stale" (még használható,
  de gyengébb), 5 perc felett elveszett (a másik állomáson újra próbálható).
- Az inventoryban **nem látszik** az alapanyag állapota (tiszta/fertőzött,
  friss/romló) — csak az, hogy megvan-e.
- A rituálé beküldése után a TV-prezenter nézet (`/presenter`, stáb-only)
  csapatonként, kézzel léptetve mutatja be az eredményt, majd a dobogót.

## Ami még nyitott / a QA & Security körre vár

- **Nincs élesben tesztelve** semmi — ez a legfontosabb pont.
- A `get_routing_options()` függvény jelenleg `limit 2` + `order by random()`
  logikát használ — élő terheléses teszt kell 8-10 csapattal, hogy tényleg jól
  terítse-e szét őket.
- A fragmens-kiosztás (`Task.jsx`-ben, `myIndex % fragments.length`) a
  csapattagok `id` szerinti sorrendjén alapul — ha valaki később csatlakozik,
  az ő indexe változhat. Élő teszt kell, hogy ez nem okoz-e zavart.
- Az "5 perc után elveszett" állapotot a szerver számolja a `started_at`
  mezőtől, amit a `start_attempt()` RPC indít el, amint bárki a csapatból
  megnyitja a Task képernyőt (`Task.jsx` hívja meg betöltéskor) — ezt
  mindenképp élőben tesztelni kell (pl. mi történik, ha valaki megnyitja,
  becsukja, majd később visszatér — az óra tovább ketyeg-e a háttérben,
  ahogy kellene).
- Icon fájlok (`public/icon-192.png`, `icon-512.png`) egyelőre egyszerű
  helyettesítő grafikák — cseréld le a Creative Director által jóváhagyott
  végleges ikonokra image generation után.
- A `submit_ritual()` "domináns szörny" logikája `group by monster order by
  count(*) desc, random() limit 1` — ez helyesen dönt döntetlennél is
  (véletlenszerűen), de érdemes pár kézi teszttel ellenőrizni.

## Fejlesztői jegyzetek

- Stack: React + Vite (PWA plugin) + Tailwind + Supabase (Postgres, Auth,
  Realtime) — a jóváhagyott Tech Architect ADR szerint.
- Nincs saját backend szerver — minden logika Postgres függvényekben
  (`supabase/migrations/0001_schema.sql`) fut, RLS-szel védve.
- Deploy: GitHub Pages, a `.github/workflows/build.yml` építi és teszi ki minden
  `main` ágra pusholt változtatásnál. Beállítás: Settings → Pages → Source:
  "GitHub Actions"; Settings → Secrets and variables → Actions → két secret:
  `VITE_SUPABASE_URL` és `VITE_SUPABASE_ANON_KEY`. A publikus címe:
  `https://<felhasznalo>.github.io/<repo-neve>/` — ezt add hozzá a Supabase
  Authentication → URL Configuration → Site URL / Redirect URLs listájához
  (`https://<felhasznalo>.github.io/<repo-neve>/**`).
- A `supabase/seed/` mappa a `.gitignore`-ban van, mert a helyes válaszokat
  tartalmazza — publikus repóba nem szabad feltölteni.

## Az esemény előtt kötelező: saját email-szolgáltató (SMTP)

A Supabase beépített email-küldője csak tesztelésre való: nagyon alacsony
óránkénti limit van rajta, és csak a Supabase-szervezet tagjainak küld. 60
kolléga belépő linkjéhez saját SMTP kell (pl. Resend, Brevo, vagy a cég saját
levelezője): Project Settings → Authentication → SMTP Settings.
Érdemes megfontolni a belépést 6 jegyű kóddal a link helyett, mert a céges
levélszűrők néha "megnyitják" a linket, és a belépés lejár.
