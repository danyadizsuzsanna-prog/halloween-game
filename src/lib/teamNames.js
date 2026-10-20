// Ötletek a csapatnév-adáshoz ("Véletlen név" gomb). Mind legfeljebb 30 karakter.
const NAMES = [
  'Denevérkórus',
  'Éjszakai Műszak',
  'Szellemvadászok',
  'Holdfény Kft.',
  'Tökfejek',
  'Boszorkánykonyha',
  'Sötét Üst Társaság',
  'Kísértet Kommandó',
  'Pókháló Brigád',
  'Vámpírok Vacsorája',
  'Zombi Zöldségesek',
  'Sikoltó Szendvicsek',
  'Seprűnyél Sprinterek',
  'Csontváz Kulcsok',
  'Bűbájos Bagolyfiúk',
  'Átokfalat Kft.',
  'A Hetedik Tök',
  'Ködös Hétfő',
  'Mumus Mentők',
  'Holtak Hajnala',
  'Varázslófoltok',
  'Éjféli Eszkimó'
]

export function randomTeamName(exclude = '') {
  const pool = NAMES.filter((n) => n !== exclude)
  return pool[Math.floor(Math.random() * pool.length)]
}
