// Helyben futtatandó, a projektmappában:
//   1) Supabase SQL Editor: futtasd le ezt, és a "Download CSV" gombbal mentsd el
//      a projektmappába stations.csv néven:
//        select s.room_name, i.name as ingredient, s.kind, s.qr_code
//        from stations s join ingredients i on i.id = s.ingredient_id
//        order by s.room_name;
//   2) npm install qrcode      (egyszer)
//   3) node scripts/generate_qr_codes.mjs
// Eredmény: qr-codes/print.html — nyisd meg böngészőben és nyomtasd ki.

import QRCode from 'qrcode'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

const lines = readFileSync('stations.csv', 'utf-8').split(/\r?\n/).filter(Boolean)
const header = parseCsvLine(lines.shift())
const iRoom = header.indexOf('room_name')
const iCode = header.indexOf('qr_code')
if (iRoom < 0 || iCode < 0) throw new Error('A CSV-ben kell room_name és qr_code oszlop.')

const cards = []
for (const line of lines) {
  const cols = parseCsvLine(line)
  const room = cols[iRoom]
  const code = cols[iCode]
  const img = await QRCode.toDataURL(code, { width: 500, margin: 2 })
  cards.push(`
    <div class="card">
      <img src="${img}" />
      <div class="code">${code}</div>
      <div class="room">${room}</div>
    </div>`)
}

mkdirSync('qr-codes', { recursive: true })
writeFileSync(
  'qr-codes/print.html',
  `<!doctype html><html lang="hu"><meta charset="utf-8"><title>QR-kódok</title>
<style>
  body { font-family: sans-serif; margin: 12mm; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10mm; }
  .card { border: 1px dashed #999; padding: 6mm; text-align: center; break-inside: avoid; }
  img { width: 70mm; height: 70mm; }
  .code { font-family: monospace; font-size: 14pt; letter-spacing: 2px; margin-top: 2mm; }
  .room { font-size: 8pt; color: #888; margin-top: 2mm; }
</style>
<div class="grid">${cards.join('\n')}</div></html>`
)
console.log(`Kész: qr-codes/print.html (${cards.length} kód)`)
