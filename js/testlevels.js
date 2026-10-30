/* =====================================================================
   Resortera vs. Torre — NIVELES DE PRUEBA (ocultos)
   ---------------------------------------------------------------------
   No aparecen en ningún menú. Se cargan desde la consola del navegador:

     game.loadLevel(window.TEST_LEVELS.wind, {
       mode: 'test', id: 'test-wind', number: 1, total: 1,
       world: 0, par: 1, screen: 'play'
     });

   El campo `screen: 'play'` es necesario para salir del menú. También se
   puede usar `game.startTestLevel('wind')`, que hace lo mismo.
   ===================================================================== */

window.TEST_LEVELS = {
  wind: {
    name: 'Prueba · Viento',
    hint: 'Nivel oculto: viento base 1.0 px/paso sin ráfagas.',
    shots: 5,
    par: 2,
    fields: {
      wind: { fx: 1.0, fy: 0, gust: 0, period: 0, drag: true }
    },
    bodies: [
      { t: 'box', mat: 'wood', x: 860, y: 585, w: 26, h: 130 },
      { t: 'box', mat: 'wood', x: 980, y: 585, w: 26, h: 130 },
      { t: 'box', mat: 'wood', x: 920, y: 508, w: 180, h: 24 },
      { t: 'target', x: 920, y: 479 },
      { t: 'target', x: 1060, y: 633 },
      { t: 'box', mat: 'glass', x: 780, y: 620, w: 22, h: 60 }
    ]
  },

  water: {
    name: 'Prueba · Agua',
    hint: 'Nivel oculto: madera y vidrio flotan; la piedra y el proyectil se hunden.',
    shots: 5,
    par: 2,
    fields: {
      water: {
        y: 540,
        density: 0.0040,
        drag: 0.085,
        rise: 0,
        riseMax: 0
      }
    },
    bodies: [
      // Tres densidades distintas para comparar la flotación.
      { t: 'box', mat: 'wood', x: 640, y: 592, w: 70, h: 70 },
      { t: 'box', mat: 'glass', x: 750, y: 592, w: 52, h: 52 },
      { t: 'box', mat: 'stone', x: 860, y: 592, w: 62, h: 62 },

      // Plataforma sobre el agua con el objetivo.
      { t: 'box', mat: 'stone', x: 1080, y: 520, w: 200, h: 18, isStatic: true },
      { t: 'target', x: 1080, y: 493 },

      // Piezas ligeras para ver el arrastre del agua.
      { t: 'box', mat: 'wood', x: 960, y: 620, w: 34, h: 34 },
      { t: 'box', mat: 'glass', x: 720, y: 470, w: 20, h: 44 }
    ]
  },

  /* ------------------------- campos avanzados ---------------------- */

  wells: {
    name: 'Prueba · Pozos',
    hint: 'Nivel oculto: un pozo atrae y un repulsor empuja. Activa V para ver la rejilla.',
    shots: 5,
    par: 2,
    fields: {
      wells: [
        { id: 'atractor', x: 780, y: 330, k: 30, repel: false, rmin: 24, radius: 90 },
        { id: 'repulsor', x: 1030, y: 540, k: 22, repel: true, rmin: 24, radius: 74 }
      ]
    },
    bodies: [
      { t: 'target', x: 860, y: 300 },
      { t: 'target', x: 1110, y: 633 },
      { t: 'box', mat: 'glass', x: 760, y: 610, w: 22, h: 70 }
    ]
  },

  gravityZones: {
    name: 'Prueba · Zonas de gravedad',
    hint: 'Nivel oculto: a la izquierda cae lento; a la derecha cae rápido.',
    shots: 5,
    par: 2,
    fields: {
      gravityZones: [
        { x: 800, y: 420, w: 280, h: 230, g: 0.16 },
        { x: 1080, y: 420, w: 220, h: 230, g: 1.12 }
      ]
    },
    bodies: [
      { t: 'box', mat: 'wood', x: 740, y: 260, w: 34, h: 34 },
      { t: 'box', mat: 'stone', x: 1120, y: 260, w: 34, h: 34 },
      { t: 'target', x: 800, y: 630 },
      { t: 'target', x: 1080, y: 630 }
    ]
  },

  movers: {
    name: 'Prueba · Plataformas móviles',
    hint: 'Nivel oculto: el bloque y su objetivo viajan con la plataforma.',
    shots: 5,
    par: 2,
    fields: {
      movers: [
        { id: 'vaiven', x: 860, y: 500, ax: 130, ay: 0, omega: 0.9, phase: 0, w: 200, h: 22, mat: 'stone' }
      ]
    },
    bodies: [
      { t: 'box', mat: 'wood', x: 860, y: 477, w: 40, h: 24, mover: 'vaiven', density: 0.0012 },
      { t: 'target', x: 860, y: 447, mover: 'vaiven' },
      { t: 'target', x: 1120, y: 633 }
    ]
  },

  pulleys: {
    name: 'Prueba · Polea de Atwood',
    hint: 'Nivel oculto: las masas se mueven con a=(m1−m2)/(m1+m2)·g. Mide con game.measureAtwood().',
    shots: 5,
    par: 2,
    fields: {
      pulleys: [
        {
          id: 'atwood',
          x: 820,
          y: 240,
          r: 34,
          ropeLen: 300,
          left: { x: 786, w: 44, h: 40, mat: 'wood', density: 0.0030 },
          right: { x: 854, w: 44, h: 40, mat: 'wood', density: 0.0022 }
        }
      ]
    },
    bodies: [
      { t: 'target', x: 650, y: 633 },
      { t: 'target', x: 1120, y: 633 }
    ]
  },

  magnets: {
    name: 'Prueba · Imanes',
    hint: 'Nivel oculto: el acero sube al imán. Activar el reactor r1 apaga el imán derecho.',
    shots: 5,
    par: 2,
    birdFerrous: true,
    fields: {
      magnets: [
        { id: 'mag1', x: 900, y: 300, radius: 72, strength: 50, on: true },
        { id: 'mag2', x: 1120, y: 430, radius: 52, strength: 30, on: true, switchId: 'r1' }
      ]
    },
    bodies: [
      { t: 'box', mat: 'steel', x: 900, y: 400, w: 44, h: 40 },
      { t: 'switch', id: 'r1', x: 1120, y: 610, r: 26 },
      { t: 'target', x: 700, y: 633 },
      { t: 'target', x: 1000, y: 633 }
    ]
  },

  lasers: {
    name: 'Prueba · Láser y espejos',
    hint: 'Nivel oculto: el rayo rebota en dos espejos y enciende r1. El segundo espejo gira al golpearlo.',
    shots: 5,
    par: 2,
    fields: {
      lasers: [
        {
          id: 'laser1',
          x: 300,
          y: 180,
          angle: 0.567,
          targetId: 'r1',
          mirrors: [
            { x: 520, y: 320, len: 120, angle: 0.455, rotatable: false },
            { x: 800, y: 420, len: 120, angle: 0.428, rotatable: true }
          ]
        }
      ]
    },
    bodies: [
      { t: 'switch', id: 'r1', x: 1120, y: 600, r: 26 },
      { t: 'target', x: 620, y: 633 },
      { t: 'target', x: 1000, y: 633 }
    ]
  },

  thermal: {
    name: 'Prueba · Térmica',
    hint: 'Nivel oculto: el fuego derrite las columnas de hielo y libera la plataforma con el objetivo.',
    shots: 5,
    par: 2,
    fields: {
      thermal: {
        fires: [
          { id: 'fuego1', x: 730, y: 600, r: 130, on: true },
          { id: 'fuego2', x: 1120, y: 600, r: 70, fireSwitchId: 'r1' }
        ],
        ice: [
          { id: 'hielo1', x: 700, y: 520, w: 44, h: 120, meltRate: 2.4 },
          { id: 'hielo2', x: 760, y: 520, w: 44, h: 120, meltRate: 2.4 }
        ]
      }
    },
    bodies: [
      { t: 'box', mat: 'stone', x: 730, y: 450, w: 140, h: 20 },
      { t: 'target', x: 730, y: 417 },
      { t: 'switch', id: 'r1', x: 1120, y: 610, r: 26 },
      { t: 'target', x: 980, y: 633 }
    ]
  },

  combined: {
    name: 'Prueba · Tres campos',
    hint: 'Nivel oculto de rendimiento: pozos, gravedad y plataforma móvil a la vez.',
    shots: 5,
    par: 2,
    fields: {
      wells: [
        { x: 800, y: 300, k: 18, repel: false, rmin: 24, radius: 70 }
      ],
      gravityZones: [
        { x: 1050, y: 430, w: 220, h: 200, g: 0.30 }
      ],
      movers: [
        { id: 'combo-mover', x: 860, y: 520, ax: 90, ay: 0, omega: 1.1, phase: 0, w: 150, h: 20, mat: 'stone' }
      ]
    },
    bodies: [
      { t: 'box', mat: 'wood', x: 860, y: 498, w: 36, h: 24, mover: 'combo-mover', density: 0.0012 },
      { t: 'target', x: 860, y: 468 },
      { t: 'target', x: 1050, y: 633 },
      { t: 'target', x: 1180, y: 633 }
    ]
  },

  ammo: {
    name: 'Prueba · Proyectiles especiales',
    hint: 'Nivel oculto: selecciona munición con 1–6 o toca su icono.',
    shots: 8,
    par: 4,
    ammo: ['normal', 'heavy', 'bounce', 'explosive', 'split', 'rocket', 'normal', 'heavy'],
    bodies: [
      { t: 'box', mat: 'wood', x: 1000, y: 610, w: 30, h: 80 },
      { t: 'box', mat: 'wood', x: 1060, y: 610, w: 30, h: 80 },
      { t: 'box', mat: 'wood', x: 1030, y: 560, w: 100, h: 24 },
      { t: 'target', x: 1030, y: 530 },
      { t: 'target', x: 1150, y: 633 }
    ]
  }
};
