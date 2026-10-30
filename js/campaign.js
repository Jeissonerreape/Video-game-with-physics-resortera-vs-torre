/* =====================================================================
   Resortera vs. Torre — CAMPAÑA
   ---------------------------------------------------------------------
   Metadatos de los 5 mundos y sus 12 niveles.

   Los cinco mundos definen sus 12 slots y valores de balance como datos.
   Los niveles clásicos siguen separados en levels.js.

   Cada entrada de CAMPAIGN_LEVELS tiene el mismo formato que un nivel
   normal, más:
     - world / index / id
     - ready: true si tiene bodies jugables
     - classicIndex: índice en LEVELS si reutiliza un nivel clásico
     - hearts: corazones opcionales del nivel
     - boss: configuración del jefe (vida, posiciones y obstáculos)
   ===================================================================== */

/* Nombres de los 12 niveles de cada mundo. */
const CAMPAIGN_LEVEL_NAMES = {
  1: [
    'Deriva en la pradera', 'La poza tranquila', 'Ritmo de la meseta', 'Contrapesos gemelos',
    'Pozo de gravedad', 'Impacto pesado', 'Cadena al viento', 'Péndulo del roble',
    'Corazón entre campos', 'Ruedas y rampas', 'Gran reacción', 'El guardián'
  ],
  2: [
    'Brisa de las dunas', 'La poza del cañón', 'Meseta oscilante', 'Atwood de piedra',
    'Vórtice del desierto', 'Asedio de arena', 'Dominó de la garganta', 'Péndulo de la mina',
    'Oasis de dos corrientes', 'Espejo del mediodía', 'Tormenta encadenada', 'El centinela del viento'
  ],
  3: [
    'Brisa del puerto', 'Marea de cristal', 'Plataforma de coral', 'Contrapeso de marea',
    'Pozo abisal', 'Impacto en el muelle', 'Dominó de la corriente', 'Péndulo del faro',
    'Corazón de dos mareas', 'Hielo y fuego', 'Marea encadenada', 'El kraken de marea'
  ],
  4: [
    'Viento de la fábrica', 'Canal de enfriamiento', 'Elevador rítmico', 'Polea de fundición',
    'Pozo de la caldera', 'Demolición de acero', 'Cadena de engranajes', 'Péndulo de vapor',
    'Corazón de dos campos', 'Circuito electromagnético', 'Gran circuito', 'El autómata'
  ],
  5: [
    'Viento orbital', 'Laguna de vacío', 'Plataforma orbital', 'Atwood estelar',
    'Pozo de marea', 'Impacto de asteroide', 'Cadena orbital', 'Péndulo de la estación',
    'Corazón de dos campos', 'Resonancia y fatiga', 'Gran integración', 'El horizonte'
  ]
};

/* Pistas del Mundo 1. En los niveles que reutilizan un clásico se usa
   la pista original si existe. */
const CAMPAIGN_LEVEL_HINTS = {
  1: [
    'El viento acelera distinto cada masa; observa cómo se aparta la pieza ligera.',
    'El empuje depende del volumen sumergido, no solo del material.',
    'La plataforma repite su ciclo: el periodo importa tanto como la posición.',
    'Masas iguales equilibran la cuerda; un impulso puede romper la simetría.',
    'La atracción crece al acercarse y una zona puede cambiar la caída.',
    'El proyectil pesado pierde alcance, pero transmite más momento al impacto.',
    'Una pequeña desviación del viento puede cambiar qué ficha inicia la cadena.',
    'El peso almacena energía al subir; un empujón puede devolverla al bajar.',
    'El corazón ofrece margen extra, pero dos campos cambian la trayectoria.',
    'La inclinación y el rozamiento deciden qué rueda conserva más movimiento.',
    'Se necesitan dos reacciones distintas; el campo ambiental altera el recorrido.',
    'Cada golpe cambia el ángulo del duelo. Busca la ventana entre obstáculos.'
  ],
  2: [
    'Las ráfagas del cañón desplazan más las piezas ligeras que las pesadas.',
    'El nivel del agua oculta parte de la estructura y modifica su caída.',
    'La meseta vuelve al mismo punto cada ciclo; espera un instante favorable.',
    'Con masas equilibradas, el sistema apenas acelera hasta recibir un impulso.',
    'La gravedad cambia dentro de la zona y el pozo curva el movimiento.',
    'La piedra resiste: concentra el momento del proyectil sobre las piezas débiles.',
    'El viento puede iniciar la cadena desde un dominó distinto.',
    'La altura del péndulo guarda energía antes de convertirla en velocidad.',
    'Dos campos afectan al vuelo; el corazón puede compensar un intento.',
    'La igualdad de ángulos del rayo permite llevar luz hasta el reactor.',
    'La cadena y la plataforma móvil convierten un solo impacto en dos rutas.',
    'El Centinela cambia la dirección y la fuerza del viento tras cada golpe.'
  ],
  3: [
    'El viento costero deriva la carga de forma distinta según su masa.',
    'La flotabilidad depende de cuánto casco queda bajo la superficie.',
    'La carga acompaña a la plataforma: el momento del ciclo cambia el alcance.',
    'Un sistema equilibrado no elige dirección hasta que algo lo perturba.',
    'Acércate al pozo para notar cómo aumenta la atracción.',
    'El vidrio cede antes que la madera; usa el proyectil pesado con intención.',
    'La corriente altera el tiempo que tarda la secuencia en llegar al reactor.',
    'El péndulo cambia energía potencial por velocidad durante su arco.',
    'El corazón queda entre la marea y el pozo; cada campo desvía de otro modo.',
    'El explosivo pierde efecto con la distancia; el hielo cede al recibir calor.',
    'Combina flotabilidad, plataforma y una cadena que exige dos pasos.',
    'Cada impacto eleva la marea y desplaza al Kraken a otra posición.'
  ],
  4: [
    'El flujo de aire de la fábrica también acelera piezas de masa distinta.',
    'La flotabilidad puede sostener una pieza ligera mientras el acero se hunde.',
    'El elevador oscila; su periodo determina cuándo la carga gana impulso.',
    'Compara las masas suspendidas antes de decidir qué lado mover.',
    'El pozo y la zona de gravedad actúan a la vez, pero no por igual.',
    'El acero soporta golpes; el momento transmitido a la base es decisivo.',
    'El imán solo atrae piezas ferrosas, no todo lo que pasa cerca.',
    'La energía del péndulo puede recorrer la rampa si supera el rozamiento.',
    'Dos campos afectan al vuelo mientras el corazón ofrece otro intento.',
    'Dos reactores abren el circuito: basta una entrada de cada grupo lógico.',
    'Combina imán, gravedad y plataforma para coordinar dos reactores.',
    'La plataforma acelera tras cada golpe; reajusta el momento del impacto.'
  ],
  5: [
    'Incluso en órbita, una misma fuerza cambia más la velocidad de una masa ligera.',
    'El agua retiene el movimiento: compara la pieza sumergida con la que flota.',
    'El periodo de la plataforma puede acompasar o contradecir la carga.',
    'La máquina de Atwood intercambia energía entre sus dos masas.',
    'El campo gravitatorio se intensifica cerca del centro del pozo.',
    'El proyectil pesado transmite más momento, aunque llegue con menos velocidad.',
    'La atracción orbital puede acercar la primera ficha y desviar el resto.',
    'La velocidad del péndulo depende de la altura desde la que parte.',
    'El corazón se encuentra bajo dos campos; calcula el efecto conjunto.',
    'La estructura cede por fatiga cuando el impulso acompasa su frecuencia natural.',
    'Pozo, plataforma, imán y mecanismos convergen en dos reactores.',
    'El Horizonte acelera su órbita después de cada impacto.'
  ]
};

const CAMPAIGN_WORLD_HINTS = {
  2: 'La piedra no se rompe: úsala como escudo o busca el hueco.',
  3: 'El vidrio es frágil, pero el hielo no perdona los errores.',
  4: 'Las cuerdas y las palancas son la clave de la reacción en cadena.',
  5: 'Todas las mecánicas juntas. No hay margen para el azar.'
};

/* Pares propuestos por la búsqueda de tiros de referencia del simulador. */
const CAMPAIGN_LEVEL_PARS = {
  1: [1, 1, 2, 1, 1, 2, 2, 2, 2, 2, 4, 4],
  2: [1, 1, 2, 1, 2, 2, 2, 2, 2, 2, 4, 4],
  3: [1, 2, 2, 1, 1, 2, 2, 2, 2, 2, 4, 4],
  4: [1, 1, 2, 1, 1, 2, 2, 2, 2, 2, 4, 4],
  5: [1, 1, 2, 1, 2, 2, 2, 2, 2, 2, 4, 4]
};

/* Mecánicas que introducen los seis primeros niveles del Mundo 1.
   Los cuerpos siguen viviendo en levels.js para no duplicar los clásicos. */
const WORLD1_CLASSIC_MECHANICS = [
  'slingshot', 'glass', 'stone', 'reactorRope', 'lever', 'domino'
];

/* Niveles explícitos del Mundo 1 (1-7 a 1-12). Las posiciones están
   pensadas para que cada mecánica nueva se pueda resolver con los tiros
   indicados y el par de estrellas sea alcanzable. */
const WORLD1_LEVELS = {
  7: {
    name: 'El reactor',
    hint: 'La piedra bloquea los tiros bajos: dibuja un arco alto hasta el reactor.',
    shots: 4,
    par: 3,
    mechanic: 'reactor',
    goal: { type: 'switch' },
    bodies: [
      // Muro alto: obliga a colar el proyectil por encima.
      { t: 'box', mat: 'stone', x: 860, y: 545, w: 30, h: 210, isStatic: true },
      // Reactor elevado: el arco alto pasa el muro y baja hasta él.
      { t: 'switch', x: 1030, y: 430, r: 26 },
      // Piezas opcionales para puntuar y practicar el rebote.
      { t: 'box', mat: 'glass', x: 760, y: 615, w: 22, h: 70 },
      { t: 'target', x: 1120, y: 633 }
    ]
  },

  8: {
    name: 'La cadena',
    hint: 'Cuela el tiro por encima del muro y derriba la cadena completa hasta el reactor.',
    shots: 4,
    par: 3,
    mechanic: 'chainReactor',
    goal: { type: 'switch' },
    bodies: [
      // Plataforma, muro y objetivo de práctica.
      { t: 'box', mat: 'stone', x: 860, y: 640, w: 460, h: 20, isStatic: true },
      { t: 'box', mat: 'stone', x: 590, y: 580, w: 20, h: 140, isStatic: true },
      { t: 'target', x: 590, y: 493 },

      // Cadena larga: la última ficha llega al reactor.
      { t: 'domino', x: 700, y: 608, w: 14, h: 44 },
      { t: 'domino', x: 745, y: 608, w: 14, h: 44 },
      { t: 'domino', x: 790, y: 608, w: 14, h: 44 },
      { t: 'domino', x: 835, y: 608, w: 14, h: 44 },
      { t: 'domino', x: 880, y: 608, w: 14, h: 44 },
      { t: 'domino', x: 925, y: 608, w: 14, h: 44 },
      { t: 'domino', x: 970, y: 608, w: 14, h: 44 },
      { t: 'domino', x: 1015, y: 608, w: 14, h: 44 },

      // Solo la cadena puede activar este reactor.
      { t: 'switch', x: 1060, y: 610, r: 26, requireChain: true }
    ]
  },

  9: {
    name: 'El corazón',
    hint: 'El corazón flota sobre la estructura: golpéalo para ganar un tiro y 150 puntos.',
    shots: 4,
    par: 3,
    mechanic: 'heart',
    goal: { type: 'destroyAll' },
    hearts: [
      { x: 720, y: 320, r: 22 }
    ],
    bodies: [
      // Estructura central.
      { t: 'box', mat: 'wood', x: 860, y: 590, w: 24, h: 120 },
      { t: 'box', mat: 'wood', x: 980, y: 590, w: 24, h: 120 },
      { t: 'box', mat: 'wood', x: 920, y: 518, w: 170, h: 20 },
      { t: 'target', x: 880, y: 489 },
      { t: 'target', x: 960, y: 489 },

      // Objetivo terrestre protegido por una columna de vidrio.
      { t: 'box', mat: 'glass', x: 1040, y: 590, w: 22, h: 120 },
      { t: 'target', x: 1110, y: 633 },

      // Pieza frágil para abrir la estructura.
      { t: 'box', mat: 'glass', x: 780, y: 615, w: 22, h: 70 }
    ]
  },

  10: {
    name: 'Equilibrio',
    hint: 'La torre alta premia los golpes precisos: busca la base sin derribar los objetivos.',
    shots: 4,
    par: 3,
    mechanic: 'balance',
    goal: { type: 'destroyAll' },
    bodies: [
      // Base ancha y torre dinámica.
      { t: 'box', mat: 'stone', x: 900, y: 640, w: 250, h: 20, isStatic: true },
      { t: 'box', mat: 'wood', x: 840, y: 550, w: 30, h: 160 },
      { t: 'box', mat: 'wood', x: 960, y: 550, w: 30, h: 160 },
      { t: 'box', mat: 'wood', x: 900, y: 457, w: 180, h: 26 },
      { t: 'target', x: 860, y: 428 },
      { t: 'target', x: 940, y: 428 },
      { t: 'box', mat: 'wood', x: 900, y: 383, w: 22, h: 120 },
      { t: 'target', x: 900, y: 306 }
    ]
  },

  11: {
    name: 'Gran combo',
    hint: 'Combina la cuerda y la palanca para el reactor alto; el segundo reactor pide una parábola más tendida.',
    shots: 5,
    par: 4,
    mechanic: 'combo',
    goal: { type: 'switch' },
    hearts: [
      { x: 700, y: 325, r: 22 }
    ],
    bodies: [
      // Primer reactor: misma cadena de cuerda + palanca + bloque.
      { t: 'box', mat: 'stone', x: 850, y: 440, w: 24, h: 190, isStatic: true },
      { t: 'switch', x: 900, y: 365, r: 24 },
      { t: 'lever', x: 900, y: 580, w: 260, h: 16, mat: 'wood', density: 0.0007 },
      { t: 'box', mat: 'stone', x: 1010, y: 600, w: 20, h: 20, isStatic: true },
      { t: 'box', mat: 'wood', x: 1005, y: 560, w: 24, h: 24, density: 0.0012 },
      { t: 'rope', x: 800, y: 190, length: 260, r: 26, mat: 'stone' },
      { t: 'target', x: 850, y: 328 },

      // Segundo reactor: a la derecha del conjunto, con una parábola más
      // tendida que la del reactor alto.
      { t: 'switch', x: 1135, y: 610, r: 24 }
    ]
  },

  12: {
    name: 'El guardián',
    hint: 'El guardián cambia de posición y levanta obstáculos. Golpéalo 3 veces.',
    shots: 6,
    par: 4,
    mechanic: 'boss',
    goal: { type: 'boss' },
    boss: {
      hp: 3,
      r: 38,
      color: '#e0796c',
      slots: [
        [1040, 560],
        [900, 450],
        [1120, 570],
        [980, 525]
      ],
      obstacles: [
        { t: 'box', mat: 'stone', x: 700, y: 560, w: 24, h: 180, isStatic: true },
        { t: 'box', mat: 'stone', x: 820, y: 520, w: 140, h: 20, isStatic: true }
      ]
    },
    bodies: [
      // Un par de plataformas bajas para dar profundidad a la arena.
      { t: 'box', mat: 'stone', x: 760, y: 630, w: 120, h: 40, isStatic: true },
      { t: 'box', mat: 'stone', x: 1080, y: 630, w: 120, h: 40, isStatic: true }
    ]
  }
};

const CAMPAIGN_LEVEL_SPECS = {
  1: [
    { kind: 'wind', fields: { wind: { fx: 0.7, fy: 0.08, gust: 0.2, period: 180 } } },
    { kind: 'water', fields: { water: { y: 575, density: 0.004, drag: 0.055 } } },
    { kind: 'movers', fields: { movers: [{ id: 'lesson-platform', x: 920, y: 590, ax: 58, omega: 0.62, phase: 0.4, w: 190, h: 18, mat: 'wood' }] } },
    { kind: 'pulley', goal: { type: 'switch' }, fields: { pulleys: [{ id: 'balance', x: 900, y: 240, r: 34, ropeLen: 340, left: { w: 42, h: 42, mat: 'stone', density: 0.008 }, right: { w: 42, h: 42, mat: 'stone', density: 0.0024 } }] } },
    { kind: 'well', fields: { wells: [{ x: 930, y: 370, k: 12, radius: 82 }], gravityZones: [{ x: 930, y: 510, w: 250, h: 170, g: 0.24 }] } },
    { kind: 'demolition' },
    { kind: 'chain', goal: { type: 'switch' }, fields: { wind: { fx: 0.48, fy: 0, gust: 0.12, period: 210 } } },
    { kind: 'pendulum', fields: { gravityZones: [{ x: 970, y: 570, w: 270, h: 150, g: 0.38 }] } },
    { kind: 'heart', fields: { wind: { fx: 0.28, fy: 0.04, gust: 0.08, period: 190 }, wells: [{ x: 1030, y: 440, k: 1.5, radius: 40 }] } },
    { kind: 'special', special: 'inclines' },
    { kind: 'combo', goal: { type: 'switch' }, fields: { wind: { fx: 0.45, gust: 0.1, period: 180 }, wells: [{ x: 990, y: 430, k: 9, radius: 68 }], movers: [{ id: 'combo-track', x: 1030, y: 625, ax: 24, omega: 0.45, w: 140, h: 14 }] } },
    { kind: 'boss', fields: null }
  ],
  2: [
    { kind: 'wind', fields: { wind: { fx: 0.72, fy: 0.04, gust: 0.24, period: 170 } } },
    { kind: 'water', fields: { water: { y: 580, density: 0.004, drag: 0.06 } } },
    { kind: 'movers', fields: { movers: [{ id: 'lesson-platform', x: 910, y: 590, ax: 64, omega: 0.7, phase: 0.2, w: 200, h: 18, mat: 'stone' }] } },
    { kind: 'pulley', goal: { type: 'switch' }, fields: { pulleys: [{ id: 'balance', x: 900, y: 235, r: 34, ropeLen: 340, left: { w: 42, h: 42, mat: 'stone', density: 0.008 }, right: { w: 42, h: 42, mat: 'stone', density: 0.0024 } }] } },
    { kind: 'well', fields: { wells: [{ x: 1100, y: 250, k: 0.5, radius: 60 }], gravityZones: [{ x: 1150, y: 600, w: 100, h: 80, g: 0.05 }] } },
    { kind: 'demolition' },
    { kind: 'chain', goal: { type: 'switch' }, fields: { wind: { fx: 0.62, fy: 0.02, gust: 0.16, period: 180 } } },
    { kind: 'pendulum', fields: { gravityZones: [{ x: 980, y: 565, w: 280, h: 160, g: 0.34 }] } },
    { kind: 'heart', fields: { wind: { fx: 0.25, gust: 0.08, period: 200 }, wells: [{ x: 1040, y: 430, k: 1.5, radius: 40 }] } },
    { kind: 'special', special: 'laserCradle', goal: { type: 'destroyAll' }, fields: { lasers: [{ id: 'sun-ray', x: 300, y: 250, angle: 0, targetId: 'laser-reactor', mirrors: [{ x: 800, y: 250, len: 120, angle: 1.57079632679 }] }] } },
    { kind: 'combo', goal: { type: 'switch' }, fields: { wind: { fx: 0.55, gust: 0.16, period: 180 }, wells: [{ x: 1010, y: 430, k: 9, radius: 68 }], movers: [{ id: 'combo-track', x: 1030, y: 625, ax: 26, omega: 0.5, w: 145, h: 14 }] } },
    { kind: 'boss', fields: { wind: { fx: 0.8, fy: 0.04, gust: 0.12, period: 180 } }, boss: { hp: 3, r: 38, slots: [[1030, 520], [910, 410], [1110, 505], [970, 470]], obstacles: [{ t: 'box', mat: 'stone', x: 690, y: 560, w: 24, h: 180, isStatic: true }, { t: 'box', mat: 'wood', x: 830, y: 500, w: 150, h: 20, isStatic: true }], hitEffects: [{ wind: { fx: -1.1, fy: 0.14 } }, { wind: { fx: 1.3, fy: -0.08 } }] } }
  ],
  3: [
    { kind: 'wind', fields: { wind: { fx: 0.62, fy: -0.04, gust: 0.22, period: 200 } } },
    { kind: 'water', fields: { water: { y: 600, density: 0.004, drag: 0.05 } } },
    { kind: 'movers', fields: { movers: [{ id: 'lesson-platform', x: 915, y: 590, ax: 56, ay: 8, omega: 0.66, phase: 0.3, w: 200, h: 18, mat: 'glass' }] } },
    { kind: 'pulley', goal: { type: 'switch' }, fields: { pulleys: [{ id: 'balance', x: 900, y: 235, r: 34, ropeLen: 340, left: { w: 42, h: 42, mat: 'stone', density: 0.008 }, right: { w: 42, h: 42, mat: 'stone', density: 0.0024 } }] } },
    { kind: 'well', fields: { wells: [{ x: 930, y: 370, k: 12, radius: 82 }], gravityZones: [{ x: 930, y: 510, w: 250, h: 170, g: 0.25 }] } },
    { kind: 'demolition' },
    { kind: 'chain', goal: { type: 'switch' }, fields: { water: { y: 625, density: 0.004, drag: 0.04 } } },
    { kind: 'pendulum', fields: { gravityZones: [{ x: 970, y: 565, w: 270, h: 160, g: 0.33 }] } },
    { kind: 'heart', fields: { water: { y: 600, density: 0.004, drag: 0.045 }, wells: [{ x: 1040, y: 425, k: 2, radius: 40 }] } },
    { kind: 'special', special: 'thermalBlast', fields: { thermal: { fires: [{ x: 915, y: 610, r: 210, fireSwitchId: 'thermal-trigger', on: false }], ice: [{ x: 850, y: 585, w: 26, h: 130, meltRate: 1.35, meltFriction: 0.78 }, { x: 960, y: 585, w: 26, h: 130, meltRate: 1.35, meltFriction: 0.78 }] } } },
    { kind: 'combo', goal: { type: 'switch' }, fields: { water: { y: 620, density: 0.004, drag: 0.05 }, wells: [{ x: 1010, y: 430, k: 8, radius: 66 }], movers: [{ id: 'combo-track', x: 1030, y: 625, ax: 25, omega: 0.48, w: 140, h: 14 }] } },
    { kind: 'boss', fields: { water: { y: 620, density: 0.004, drag: 0.055, rise: 0, riseMax: 0 } }, boss: { hp: 3, r: 40, slots: [[900, 420], [1050, 450], [700, 350], [1100, 500]], obstacles: [], hitEffects: [{ waterRise: 16 }, { waterRise: 26 }] } }
  ],
  4: [
    { kind: 'wind', fields: { wind: { fx: 0.68, fy: 0.03, gust: 0.2, period: 185 } } },
    { kind: 'water', fields: { water: { y: 580, density: 0.004, drag: 0.06 } } },
    { kind: 'movers', fields: { movers: [{ id: 'lesson-platform', x: 915, y: 590, ax: 62, omega: 0.72, phase: 0.15, w: 205, h: 18, mat: 'steel' }] } },
    { kind: 'pulley', goal: { type: 'switch' }, fields: { pulleys: [{ id: 'balance', x: 900, y: 235, r: 34, ropeLen: 340, left: { w: 42, h: 42, mat: 'steel', density: 0.016 }, right: { w: 42, h: 42, mat: 'steel', density: 0.007 } }] } },
    { kind: 'well', fields: { wells: [{ x: 950, y: 370, k: 13, radius: 82 }], gravityZones: [{ x: 940, y: 510, w: 250, h: 170, g: 0.23 }] } },
    { kind: 'demolition' },
    { kind: 'chain', goal: { type: 'switch' }, fields: { magnets: [{ id: 'chain-magnet', x: 970, y: 520, radius: 70, strength: 12, on: true }] } },
    { kind: 'pendulum', fields: { gravityZones: [{ x: 980, y: 565, w: 270, h: 160, g: 0.35 }] } },
    { kind: 'heart', fields: { magnets: [{ id: 'heart-magnet', x: 990, y: 510, radius: 50, strength: 2, on: true }], wells: [{ x: 1060, y: 410, k: 2, radius: 40 }] } },
    { kind: 'special', special: 'magnetCircuit', goal: { type: 'switch' }, fields: { magnets: [{ id: 'coil-a', x: 850, y: 535, radius: 84, strength: 22, switchId: 'gate-a' }, { id: 'coil-b', x: 1010, y: 530, radius: 84, strength: 24, switchId: 'gate-c' }] } },
    { kind: 'combo', goal: { type: 'switch' }, fields: { magnets: [{ id: 'combo-coil', x: 1010, y: 520, radius: 88, strength: 16, on: true }], wells: [{ x: 930, y: 410, k: 9, radius: 65 }], movers: [{ id: 'combo-track', x: 1030, y: 625, ax: 26, omega: 0.5, w: 145, h: 14 }] } },
    { kind: 'boss', fields: { movers: [{ id: 'boss-platform', x: 1010, y: 600, ax: 78, omega: 0.42, phase: 0, w: 210, h: 18, mat: 'steel' }] }, boss: { hp: 3, r: 38, slots: [[1010, 520], [920, 460], [1100, 500], [980, 445]], motion: { type: 'platform', moverId: 'boss-platform', offsetY: -80 }, obstacles: [{ t: 'box', mat: 'stone', x: 700, y: 570, w: 24, h: 160, isStatic: true }, { t: 'box', mat: 'steel', x: 820, y: 500, w: 150, h: 20, isStatic: true }], hitEffects: [{ mover: { id: 'boss-platform', omega: 0.68 } }, { mover: { id: 'boss-platform', omega: 0.98 } }] } }
  ],
  5: [
    { kind: 'wind', fields: { wind: { fx: 0.64, fy: -0.03, gust: 0.22, period: 190 } } },
    { kind: 'water', fields: { water: { y: 580, density: 0.004, drag: 0.06 } } },
    { kind: 'movers', fields: { movers: [{ id: 'lesson-platform', x: 915, y: 590, ax: 61, ay: 10, omega: 0.7, phase: 0.5, w: 205, h: 18, mat: 'steel' }] } },
    { kind: 'pulley', goal: { type: 'switch' }, fields: { pulleys: [{ id: 'balance', x: 900, y: 235, r: 34, ropeLen: 340, left: { w: 42, h: 42, mat: 'steel', density: 0.016 }, right: { w: 42, h: 42, mat: 'steel', density: 0.007 } }] } },
    { kind: 'well', fields: { wells: [{ x: 950, y: 370, k: 14, radius: 88 }], gravityZones: [{ x: 940, y: 510, w: 250, h: 170, g: 0.22 }] } },
    { kind: 'demolition' },
    { kind: 'chain', goal: { type: 'switch' }, fields: { wells: [{ x: 1000, y: 480, k: 12, radius: 75 }] } },
    { kind: 'pendulum', fields: { gravityZones: [{ x: 970, y: 565, w: 270, h: 160, g: 0.31 }] } },
    { kind: 'heart', fields: { wells: [{ x: 700, y: 340, k: 2, radius: 45 }], gravityZones: [{ x: 1010, y: 570, w: 240, h: 150, g: 0.18 }] } },
    { kind: 'special', special: 'resonance', fields: { resonance: { id: 'resonant-span', x: 930, y: 560, anchorY: 470, w: 180, h: 20, mat: 'steel', omega: 2.4, naturalOmega: 2.4, phase: 0, amplitude: 0.28, fatigueRate: 0.18, fatigueLimit: 100, bandwidth: 0.2 } } },
    { kind: 'combo', goal: { type: 'switch' }, fields: { wells: [{ x: 1020, y: 430, k: 4, radius: 60 }], movers: [{ id: 'combo-track', x: 1030, y: 625, ax: 16, omega: 0.4, w: 145, h: 14 }], magnets: [{ id: 'combo-coil', x: 870, y: 520, radius: 65, strength: 6, on: true }] } },
    { kind: 'boss', fields: { wells: [{ id: 'boss-well', x: 1000, y: 455, k: 15, radius: 90 }] }, boss: { hp: 3, r: 38, slots: [[1170, 455], [1000, 285], [830, 455], [1000, 625]], obstacles: [{ t: 'box', mat: 'steel', x: 700, y: 565, w: 24, h: 170, isStatic: true }, { t: 'box', mat: 'glass', x: 820, y: 500, w: 145, h: 20, isStatic: true }], motion: { type: 'orbit', x: 1000, y: 455, radius: 170, omega: 0.35, phase: 0.4, acceleration: 0.18 }, hitEffects: [] } }
  ]
};

function makeWorldSlots(worldId) {
  const names = CAMPAIGN_LEVEL_NAMES[worldId] || [];
  const hints = CAMPAIGN_LEVEL_HINTS[worldId] || [];
  const specs = CAMPAIGN_LEVEL_SPECS[worldId] || [];
  const slots = [];

  for (let index = 1; index <= 12; index++) {
    const spec = specs[index - 1] || {};
    const name = names[index - 1] || `Nivel ${index}`;
    const concept = hints[index - 1] || CAMPAIGN_WORLD_HINTS[worldId];
    const boss = spec.boss || (worldId === 1 && index === 12
      ? cloneLevelData(WORLD1_LEVELS[12].boss)
      : null);
    const shots = index <= 5 ? 3 : (index <= 10 ? 4 : 6);
    const ammo = index <= 5
      ? ['normal', 'normal', 'heavy']
      : (index <= 9
        ? ['normal', 'heavy', 'bounce', 'bounce']
        : (index === 10
          ? ['normal', 'heavy', 'bounce', 'explosive']
          : ['normal', 'heavy', 'bounce', 'explosive', 'split', 'rocket']));
    const params = {
      nombre: name,
      concepto: concept,
      seed: worldId * 100 + index,
      kind: index === 12 ? 'boss' : spec.kind,
      special: spec.special,
      shots: shots,
      par: CAMPAIGN_LEVEL_PARS[worldId][index - 1] || Math.max(1, shots - 1),
      ammo: ammo,
      fields: cloneLevelData(spec.fields || null),
      goal: cloneLevelData(spec.goal || null),
      hearts: index === 9 || index === 11 ? [{ x: 700, y: 325, r: 22 }] : [],
      boss: cloneLevelData(boss)
    };

    slots.push({
      slot: index,
      nombre: name,
      concepto: concept,
      template: index === 12 ? 'boss' : 'lesson',
      params: params,
      mechanic: spec.kind || (index === 12 ? 'boss' : null),
      classicIndex: null
    });
  }

  return slots;
}

const WORLD_MECHANICS = {
  1: ['slingshot', 'glass', 'stone', 'rope', 'lever', 'domino', 'reactor', 'heart', 'boss'],
  2: ['wind', 'stone', 'shield', 'rope', 'lever', 'domino', 'reactor', 'sand'],
  3: ['water', 'glass', 'ice', 'buoyancy', 'rope', 'domino', 'reactor', 'heart'],
  4: ['movers', 'magnet', 'gear', 'steam', 'rope', 'lever', 'thermal', 'reactor'],
  5: ['wells', 'gravity', 'laser', 'mirror', 'movers', 'magnet', 'thermal', 'boss']
};

const WORLD_DESCRIPTIONS = {
  1: 'Aprende a apuntar, cortar, empujar y encadenar.',
  2: 'Viento cíclico, mesetas de piedra y remolinos de arena.',
  3: 'Corrientes, burbujas y mecanismos junto al arrecife.',
  4: 'Engranajes, vapor y mecanismos de fábrica.',
  5: 'Campos orbitales y gravedad en la estación final.'
};

const WORLD_SUBTITLES = {
  1: 'Fundamentos', 2: 'Viento y precisión', 3: 'Agua y equilibrio',
  4: 'Máquinas y calor', 5: 'Campos y gravedad'
};

const WORLD_TEST_FIELDS = {
  1: {},
  2: { wind: { fx: 0.7, gust: 0.15, period: 150 } },
  3: { water: { y: 590, drag: 0.04, rise: 0.025, riseMax: 35 } },
  4: { movers: [{ id: 'theme-mover', x: 900, y: 560, ax: 55, omega: 0.7, w: 180, h: 18 }] },
  5: { wells: [{ x: 900, y: 360, k: 12, radius: 70 }] }
};

const WORLDS = {};
for (let id = 1; id <= 5; id++) {
  const theme = getTheme(id);
  const bossSlot = CAMPAIGN_LEVEL_SPECS[id][11].boss ||
    (id === 1 ? WORLD1_LEVELS[12].boss : null);
  const bossDef = bossSlot
    ? cloneLevelData(bossSlot)
    : { hp: 3, r: 38, color: theme.palette.reactor, slots: [[1040, 540]] };
  WORLDS[id] = {
    id: id,
    nombre: theme.nombre,
    tema: theme.id,
    intensidad: INTENSITY[id - 1],
    descripcion: WORLD_DESCRIPTIONS[id],
    mecanicas: WORLD_MECHANICS[id].slice(),
    jefe: bossDef,
    materials: {
      primary: id === 2 ? 'stone' : (id === 3 ? 'wood' : (id === 4 ? 'stone' : (id === 5 ? 'glass' : 'wood'))),
      secondary: id === 2 ? 'wood' : (id === 3 ? 'glass' : 'steel'),
      accent: id === 3 ? 'ice' : (id >= 4 ? 'steel' : 'glass')
    },
    camposPrueba: cloneLevelData(WORLD_TEST_FIELDS[id]),
    niveles: makeWorldSlots(id),
    name: theme.nombre,
    subtitle: WORLD_SUBTITLES[id],
    color: theme.palette.groundTop,
    dark: theme.palette.skyTop,
    accent: theme.palette.accent,
    description: WORLD_DESCRIPTIONS[id]
  };
}

const CAMPAIGN_WORLDS = Object.values(WORLDS);
const CAMPAIGN_LEVELS = [];

for (const world of CAMPAIGN_WORLDS) {
  for (const slot of world.niveles) {
    const index = slot.slot;
    const def = TEMPLATES[slot.template](slot.params, world);
    def.name = slot.nombre;
    def.hint = slot.concepto;
    def.shots = Math.max(1, Number(slot.params.shots) || def.shots || 4);
    def.par = Math.max(1, Number(slot.params.par) || def.par || def.shots - 1);
    const ready = slot.template !== 'construction';
    CAMPAIGN_LEVELS.push(Object.assign(def, {
      id: `${world.id}-${index}`,
      world: world.id,
      index: index,
      nombre: slot.nombre,
      concepto: slot.concepto,
      template: slot.template,
      params: cloneLevelData(slot.params),
      worldTheme: world.tema,
      intensity: world.intensidad,
      mechanic: slot.mechanic,
      ready: ready,
      classicIndex: slot.classicIndex
    }));
  }
}

function getCampaignWorld(world) {
  return WORLDS[world] || null;
}

function getCampaignLevel(world, index) {
  return CAMPAIGN_LEVELS.find((item) => item.world === world && item.index === index) || null;
}

function getCampaignLevels(world) {
  return CAMPAIGN_LEVELS.filter((item) => item.world === world);
}

function getCampaignWorldStars(progress, world) {
  return progress ? progress.getWorldStars(world) : 0;
}
