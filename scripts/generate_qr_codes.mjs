// Helyben futtatandó (nem itt, a Claude sandboxban, mert az nem ér el
// internetet): npm install qrcode, majd `node scripts/generate_qr_codes.mjs`
//
// Minden állomáshoz legyárt egy PNG QR-kódot a qr-codes/ mappába. A QR
// tartalma maga a kód string (pl. "RITUAL-01") — ezt a telefonos app egy
// egyszerű szöveg-összevetéssel azonosítja majd a megfelelő állomással.
// (Élesben érdemesebb egy teljes URL-t kódolni, pl.
// https://<domain>/task/<station_id> — cseréld le a CODES tömböt a saját
// Supabase station id-jaidra a seed lefuttatása után.)

import QRCode from 'qrcode'
import { mkdirSync } from 'node:fs'

const CODES = [
  'RITUAL-01', 'RITUAL-02', 'RITUAL-03', 'RITUAL-04', 'RITUAL-05', 'RITUAL-06',
  'RITUAL-07', 'RITUAL-08', 'RITUAL-09', 'RITUAL-10', 'RITUAL-11', 'RITUAL-12',
  'RITUAL-13', 'RITUAL-14', 'RITUAL-15', 'RITUAL-16', 'RITUAL-17', 'RITUAL-18'
]

mkdirSync('qr-codes', { recursive: true })

for (const code of CODES) {
  await QRCode.toFile(`qr-codes/${code}.png`, code, { width: 600, margin: 2 })
  console.log(`Kész: qr-codes/${code}.png`)
}
