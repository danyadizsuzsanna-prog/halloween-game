// Képkészlet-választó.
//
// A játék két kész képkészlettel rendelkezik (public/img/<készlet>/):
//   'illusztrativ' — tiszta, matricás illusztráció (alapértelmezett)
//   'sotet'        — komor, tusrajzos, "graphic novel" stílus
//
// Váltáshoz csak az IMAGE_SET értékét kell átírni, majd commit + push.

export const IMAGE_SET = 'illusztrativ' // 'illusztrativ' | 'sotet'

const BASE = import.meta.env?.BASE_URL ?? '/'

export const imgUrl = (name) => `${BASE}img/${IMAGE_SET}/${name}.webp`

// Készletenkénti elrendezés a kivetítős jelenethez (a jelenet %-ában).
const LAYOUT = {
  illusztrativ: {
    cauldron: { w: 38, h: 37 }, // az üst képének mérete
    glow: { left: 18, top: 33, width: 64, height: 12 }, // a főzet-derengés helye az üst képén belül
    landingTop: 49, // itt "érnek be" a hozzávalók (az üst peremének magassága)
    smokeFilter: 'none'
  },
  sotet: {
    cauldron: { w: 34, h: 41 },
    glow: { left: 14, top: 23, width: 72, height: 14 },
    landingTop: 45,
    smokeFilter: 'brightness(1.7) contrast(1.1)'
  }
}

export const LAYOUT_NOW = LAYOUT[IMAGE_SET] ?? LAYOUT.illusztrativ
