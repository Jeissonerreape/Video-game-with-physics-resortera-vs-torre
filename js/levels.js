/* =====================================================================
   Resortera vs. Torre — NIVELES
   Cada cuerpo se define con coordenadas de su CENTRO.
   Tipos:
     { t:'box',    mat:'wood'|'stone'|'glass', x, y, w, h, angle? }
     { t:'target', x, y, r? }   -> objetivo a destruir
   El suelo (y = 650) se crea automáticamente.
   ===================================================================== */

const LEVELS = [
  /* ---------------------------------------------------------------- */
  {
    name: 'El establo',
    shots: 3,
    bodies: [
      // Dos columnas de madera y un dintel encima
      { t: 'box', mat: 'wood', x: 860, y: 585, w: 26, h: 130 },
      { t: 'box', mat: 'wood', x: 980, y: 585, w: 26, h: 130 },
      { t: 'box', mat: 'wood', x: 920, y: 508, w: 180, h: 24 },

      // Objetivo sobre el dintel y otro a la intemperie
      { t: 'target', x: 920, y: 479 },
      { t: 'target', x: 1060, y: 633 },

      // Detalle destructible
      { t: 'box', mat: 'glass', x: 780, y: 620, w: 22, h: 60 }
    ]
  },

  /* ---------------------------------------------------------------- */
  {
    name: 'Doble torre',
    shots: 4,
    bodies: [
      // Base de piedra + torre de madera
      { t: 'box', mat: 'stone', x: 960, y: 639, w: 240, h: 22 },
      { t: 'box', mat: 'wood', x: 890, y: 563, w: 26, h: 130 },
      { t: 'box', mat: 'wood', x: 1030, y: 563, w: 26, h: 130 },
      { t: 'box', mat: 'wood', x: 960, y: 487, w: 170, h: 22 },

      { t: 'target', x: 960, y: 459, r: 17 },

      // Columna de vidrio con un objetivo en equilibrio arriba
      { t: 'box', mat: 'glass', x: 1110, y: 605, w: 24, h: 90 },
      { t: 'target', x: 1110, y: 543, r: 17 },

      // Objetivo a ras de suelo
      { t: 'target', x: 760, y: 633, r: 17 }
    ]
  },

  /* ---------------------------------------------------------------- */
  {
    name: 'La fortaleza',
    shots: 4,
    bodies: [
      // Base de piedra
      { t: 'box', mat: 'stone', x: 930, y: 639, w: 220, h: 22 },

      // Muros de madera (destructibles) y techo
      { t: 'box', mat: 'wood', x: 860, y: 563, w: 26, h: 130 },
      { t: 'box', mat: 'wood', x: 1010, y: 563, w: 26, h: 130 },
      { t: 'box', mat: 'wood', x: 935, y: 486, w: 210, h: 24 },

      // Objetivos: uno expuesto arriba y dos protegidos dentro
      { t: 'target', x: 935, y: 457, r: 17 },
      { t: 'target', x: 900, y: 611, r: 17 },
      { t: 'target', x: 980, y: 611, r: 17 },

      // Columna de vidrio interior (cadena de destrucción)
      { t: 'box', mat: 'glass', x: 935, y: 583, w: 22, h: 90 },

      // Escudo de piedra delante: obliga a buscar ángulos
      { t: 'box', mat: 'stone', x: 790, y: 620, w: 60, h: 60 }
    ]
  },

  /* ================================================================
     NIVELES DE REACCIÓN EN CADENA
     El objetivo ya no es destruirlo todo: hay que activar un reactor.
     ================================================================ */

  /* ---------------------------------------------------------------- */
  {
    name: 'El peso colgante',
    shots: 3,
    hint: 'Corta la cuerda para que el peso caiga sobre el reactor.',
    goal: { type: 'switch' },
    bodies: [
      // Escudo que obliga a buscar un tiro alto
      { t: 'box', mat: 'stone', x: 880, y: 565, w: 26, h: 170 },
      { t: 'box', mat: 'stone', x: 880, y: 470, w: 90, h: 18 },

      // Objetivo: reactor en el suelo, detrás del escudo
      { t: 'switch', x: 980, y: 620, r: 24 },

      // Peso de piedra colgando justo encima del reactor
      { t: 'rope', x: 980, y: 210, length: 330, r: 26, mat: 'stone' },

      // Objetivo decorativo / puntos extra
      { t: 'target', x: 1080, y: 633 }
    ]
  },

  /* ---------------------------------------------------------------- */
  {
    name: 'La catapulta',
    shots: 3,
    hint: 'Corta la cuerda: el peso hará palanca y lanzará el bloque.',
    goal: { type: 'switch' },
    bodies: [
      // Escudo que tapa el reactor desde la resortera
      { t: 'box', mat: 'stone', x: 850, y: 440, w: 24, h: 190 },

      // Reactor elevado
      { t: 'switch', x: 900, y: 365, r: 24 },

      // Palanca central con tope para que empiece nivelada
      { t: 'lever', x: 900, y: 580, w: 260, h: 16, mat: 'wood', density: 0.0007 },
      { t: 'box', mat: 'stone', x: 1010, y: 600, w: 20, h: 20, isStatic: true },

      // Bloque ligero que sale lanzado
      { t: 'box', mat: 'wood', x: 1005, y: 560, w: 24, h: 24, density: 0.0012 },

      // Peso pesado colgando sobre el brazo izquierdo
      { t: 'rope', x: 800, y: 190, length: 260, r: 26, mat: 'stone' },

      { t: 'target', x: 850, y: 328 }
    ]
  },

  /* ---------------------------------------------------------------- */
  {
    name: 'Dominó',
    shots: 3,
    hint: 'Derrumba la cadena de fichas y lleva la reacción hasta el reactor.',
    goal: { type: 'switch' },
    bodies: [
      // Plataforma y muro que obliga a colar el tiro por arriba
      { t: 'box', mat: 'stone', x: 830, y: 640, w: 380, h: 20, isStatic: true },
      { t: 'box', mat: 'stone', x: 480, y: 580, w: 20, h: 140, isStatic: true },
      { t: 'target', x: 480, y: 493 },

      // Cadena de fichas
      { t: 'domino', x: 700, y: 608, w: 14, h: 44 },
      { t: 'domino', x: 745, y: 608, w: 14, h: 44 },
      { t: 'domino', x: 790, y: 608, w: 14, h: 44 },
      { t: 'domino', x: 835, y: 608, w: 14, h: 44 },
      { t: 'domino', x: 880, y: 608, w: 14, h: 44 },
      { t: 'domino', x: 925, y: 608, w: 14, h: 44 },

      // Solo la cadena puede activarlo
      { t: 'switch', x: 970, y: 610, r: 26, requireChain: true }
    ]
  }
];
