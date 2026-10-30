/* =====================================================================
   Resortera vs. Torre — CONFIGURACIÓN
   Todas las constantes de física y de juego viven aquí para poder
   ajustar la "sensación" del juego sin tocar la lógica.
   ===================================================================== */

const CONFIG = {
  // --- Lienzo ---------------------------------------------------------
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 650,          // borde superior del suelo (el resto es tierra)

  // --- Simulación -----------------------------------------------------
  GRAVITY: 2.2,           // Matter aplica: fuerza = masa * gravedad * 0.001
  STEP_MS: 1000 / 60,     // paso fijo de física (determinista)
  MAX_STEPS: 4,           // pasos máximos por frame (evita espirales de muerte)

  // --- Resortera ------------------------------------------------------
  FORK: { x: 215, y: 470 },  // punto donde se sostiene el proyectil
  MAX_STRETCH: 125,          // estiramiento máximo de la goma (px)
  MIN_STRETCH: 18,           // por debajo de esto el disparo se cancela
  MAX_SPEED: 26,             // velocidad máxima al soltar (px por paso)
  BIRD_RADIUS: 17,
  GRAB_RADIUS: 165,          // radio de "agarre" alrededor de la resortera

  // --- Daño por impacto ----------------------------------------------
  // daño = velocidad_relativa * masa_reducida * DAMAGE_K * fragilidad
  DAMAGE_K: 0.42,
  MIN_IMPACT_SPEED: 3.0,     // por debajo no cuenta como golpe
  MIN_DAMAGE: 1.5,
  GRACE: 0.6,                // segundos sin daño al cargar el nivel (asentar)

  // --- Ritmo de juego -------------------------------------------------
  RELOAD: 0.55,              // espera antes de la siguiente munición
  SETTLE: 2.2,               // espera tras el último tiro antes de perder
  MAX_FLIGHT: 7.0,           // tiro "eterno" se da por terminado
  REST_SPEED: 0.9,           // velocidad considerada "en reposo"

  // --- Puntuación -----------------------------------------------------
  SCORE_TARGET: 100,
  SCORE_BLOCK: 10,
  SCORE_SHOT_BONUS: 50,      // por tiro no usado al ganar
  SCORE_MECHANISM: 25,       // cuerda cortada o palanca activada
  SCORE_SWITCH: 100,         // reactor activado
  SCORE_DOMINO: 5,           // por cada ficha de dominó derribada
  SCORE_STAR: 200,           // bonus por estrella en Aventura/Hardcore
  SCORE_HEART: 150,          // bonus por corazón recogido
  SCORE_BOSS_HIT: 250,       // por cada golpe válido al jefe
  HARDCORE_MIN_STARS: 3,
  HARDCORE_LEVEL_BONUS: 100,
  HARDCORE_BOSS_BONUS: 200,
  INFINITE_STARTING_RESERVE: 3,
  INFINITE_MAX_RESERVE: 5,
  INFINITE_VALIDATION_ATTEMPTS: 12,       // por cada golpe válido al jefe
  BEST_KEY: 'resortera_vs_torre_best',       // récord antiguo (compatibilidad)
  SAVE_KEY: 'resortera_vs_torre_save_v2',    // progreso nuevo por nivel
  MUTE_KEY: 'resortera_vs_torre_mute',

  // --- Reacción en cadena ---------------------------------------------
  ROPE_CUT_PAD: 10,          // margen extra alrededor de la cuerda
  ROPE_CUT_SPEED: 4,         // velocidad mínima del proyectil para cortar
  SWITCH_MIN_SPEED: 3.0,     // velocidad mínima de impacto en el reactor
  SWITCH_MIN_MASS: 0.5,      // masa mínima del cuerpo que activa el reactor
  LEVER_ANGLE: 0.20,         // giro que considera activada una palanca
  DOMINO_ANGLE: 0.42,        // giro que considera caída una ficha

  // --- Campos (viento y agua) ----------------------------------------
  // Viento: F = c · área · (v_viento − v_cuerpo), en unidades de Matter.
  // Calibrado para que un tiro a 45° y potencia máxima (800 px de vuelo)
  // se desvíe ~42 px con fx = 1.0. Ver README 4.10 y contexto.md.
  FIELD_WIND_C: 6.4e-8,
  FIELD_WIND_MAX_FORCE: 0.02,   // tope de seguridad por cuerpo y paso
  FIELD_PREDICT_STEPS: 150,     // pasos máximos de la línea de puntos
  FIELD_SPLASH_SPEED: 2.5,      // velocidad mínima para chapotear

  // Agua: densidad en las mismas unidades que MATERIALS (masa / área).
  // 0.0040 deja la madera (0.0024) al 60% sumergida y la piedra hundida.
  FIELD_WATER_DENSITY: 0.0040,
  FIELD_WATER_DRAG: 0.085,      // frictionAir extra con el cuerpo sumergido
  FIELD_WATER_ANGULAR_DAMP: 0.30, // amortiguación angular dentro del agua

  // --- Campos avanzados (fase 1A ampliada) ---------------------------
  // Pozos: F = k · m / max(r, rmin)². k = 24 a 100 px produce una
  // aceleración del orden de la gravedad global (≈0,55 px/paso²).
  FIELD_WELL_K: 24,
  FIELD_WELL_RMIN: 24,
  FIELD_WELL_RADIUS: 90,
  // Gravedad por zonas: el dato `g` está en px/paso². La gravedad
  // global equivale a 0.001·2.2·16.6667² ≈ 0.611 px/paso².
  FIELD_ZONE_MIN_G: 0.02,
  FIELD_ZONE_MAX_G: 1.60,
  // Plataformas móviles: fricción efectiva alta para arrastrar cargas.
  FIELD_MOVER_FRICTION: 1.0,
  // Imanes: F = strength · m / max(r, rmin)².
  FIELD_MAGNET_STRENGTH: 18,
  FIELD_MAGNET_RMIN: 22,
  FIELD_MAGNET_RADIUS: 62,
  // Láser: rebotes máximos y alcance de trazado.
  FIELD_LASER_MAX_BOUNCE: 8,
  FIELD_LASER_RANGE: 1900,
  // Térmica: temperatura de fusión y calor por paso a distancia cero.
  FIELD_ICE_MAX_TEMP: 100,
  FIELD_ICE_MELT_RATE: 1.5,
  // Escala didáctica para pasar aceleraciones a m/s² (≈90 px = 1 m).
  FIELD_PX_PER_METER: 90
};

const INTENSITY = [1.0, 1.25, 1.5, 1.75, 2.0];

/* Materiales: densidad, fricción, rebote, vida y fragilidad.
   Los valores están en unidades de Matter (px, masa aproximada). */
const MATERIALS = {
  wood: {
    name: 'madera',
    density: 0.0024,
    friction: 0.62,
    restitution: 0.08,
    hp: 58,
    damageMult: 1.0,
    fill: '#c1854f',
    fillDark: '#a26a3a',
    stroke: '#7d4f27',
    grain: 'rgba(94, 55, 22, 0.35)'
  },
  stone: {
    name: 'piedra',
    density: 0.0060,
    friction: 0.85,
    restitution: 0.04,
    hp: 320,
    damageMult: 0.45,
    fill: '#98a2ac',
    fillDark: '#7d8791',
    stroke: '#5f6973',
    grain: 'rgba(60, 70, 80, 0.35)'
  },
  glass: {
    name: 'vidrio',
    density: 0.0016,
    friction: 0.22,
    restitution: 0.05,
    hp: 32,
    damageMult: 2.4,
    fill: 'rgba(186, 231, 250, 0.72)',
    fillDark: 'rgba(140, 205, 235, 0.7)',
    stroke: '#79bedd',
    grain: 'rgba(255, 255, 255, 0.75)'
  },
  steel: {
    name: 'acero',
    density: 0.0120,
    friction: 0.72,
    restitution: 0.04,
    hp: 420,
    damageMult: 0.30,
    ferrous: true,
    fill: '#9aa7b5',
    fillDark: '#7a8795',
    stroke: '#525d69',
    grain: 'rgba(45, 55, 68, 0.35)'
  },
  ice: {
    name: 'hielo',
    density: 0.0009,
    friction: 0.02,
    restitution: 0.02,
    hp: 55,
    damageMult: 1.2,
    fill: 'rgba(196, 238, 252, 0.80)',
    fillDark: 'rgba(150, 216, 242, 0.75)',
    stroke: '#8bd2eb',
    grain: 'rgba(255, 255, 255, 0.80)'
  },
  domino: {
    name: 'dominó',
    density: 0.0017,
    friction: 0.58,
    restitution: 0.02,
    hp: 200,
    damageMult: 0.2,
    fill: '#efe3c4',
    fillDark: '#d8c69c',
    stroke: '#b49a66',
    grain: 'rgba(120, 95, 55, 0.35)'
  },
  bird: {
    name: 'proyectil',
    density: 0.0085,
    friction: 0.6,
    restitution: 0.32,
    frictionAir: 0.004
  }
};

/* Vida de los objetivos ("chanchos" de madera pintada). */
const TARGET = {
  density: 0.0022,
  friction: 0.7,
  restitution: 0.05,
  hp: 14,
  damageMult: 1.5,
  radius: 17
};

/* =====================================================================
   PROYECTILES ESPECIALES (fase 4.12)
   ---------------------------------------------------------------------
   El tipo `normal` reproduce exactamente el proyectil histórico: sus
   valores salen de MATERIALS.bird, así que los 6 niveles clásicos no
   cambian. El resto son variantes declarativas; `game.js` solo lee estos
   datos, nunca compara números de nivel.

   Un nivel puede declarar `ammo: ['normal','heavy',...]` en orden de uso.
   Si no lo declara, se rellena con `shots` proyectiles normales.
   ===================================================================== */
const AMMO_ORDER = ['normal', 'heavy', 'bounce', 'explosive', 'split', 'rocket'];

const AMMO_TYPES = {
  normal: {
    id: 'normal',
    name: 'normal',
    label: 'NORMAL',
    color: '#e0453c',
    edge: '#a5281f',
    density: MATERIALS.bird.density,
    friction: MATERIALS.bird.friction,
    restitution: MATERIALS.bird.restitution,
    frictionAir: MATERIALS.bird.frictionAir,
    radiusScale: 1,
    launchScale: 1
  },

  /* Más masa con el mismo "trabajo de goma": sale algo más lento, pero
     su momento p = m·v y su capacidad de empujar son mayores. */
  heavy: {
    id: 'heavy',
    name: 'pesado',
    label: 'PESADO',
    color: '#8b98a6',
    edge: '#4e5964',
    density: MATERIALS.bird.density * 2.2,
    friction: 0.70,
    restitution: 0.28,
    frictionAir: MATERIALS.bird.frictionAir,
    radiusScale: 1.15,
    launchScale: 0.8
  },

  /* Restitución muy alta y fricción baja: conserva velocidad en cada
     rebote y vuelve a saltar en el suelo y en las paredes. */
  bounce: {
    id: 'bounce',
    name: 'rebote',
    label: 'REBOTE',
    color: '#3fb7d8',
    edge: '#1d7f9c',
    density: MATERIALS.bird.density * 0.8,
    friction: 0.12,
    restitution: 0.92,
    frictionAir: 0.0032,
    radiusScale: 1,
    launchScale: 1
  },

  /* Explota al primer contacto suficientemente rápido. */
  explosive: {
    id: 'explosive',
    name: 'explosivo',
    label: 'EXPLOSIVO',
    color: '#f08a2c',
    edge: '#a55313',
    density: MATERIALS.bird.density,
    friction: MATERIALS.bird.friction,
    restitution: MATERIALS.bird.restitution,
    frictionAir: MATERIALS.bird.frictionAir,
    radiusScale: 1,
    launchScale: 1,
    blastRadius: 150,       // R en px
    blastImpulse: 0.18,     // F = blastImpulse·m·(1−d/R)² / max(d,10)
    blastMinSpeed: 3.0,     // umbral de contacto para detonar
    blastDamage: 48         // daño base en el centro, con caída (1−d/R)²
  },

  /* Se parte en tres conservando el momento: se puede pulsar en vuelo
     (clic/toque/espacio) o esperar a `splitDelay` pasos. */
  split: {
    id: 'split',
    name: 'divisible',
    label: 'DIVIDIR',
    color: '#b07cd8',
    edge: '#704399',
    density: MATERIALS.bird.density,
    friction: MATERIALS.bird.friction,
    restitution: MATERIALS.bird.restitution,
    frictionAir: MATERIALS.bird.frictionAir,
    radiusScale: 1,
    launchScale: 1,
    splitDelay: 45,         // pasos fijos (0,75 s)
    splitAngle: 12 * Math.PI / 180,
    splitSideSpeed: 0.85,   // los laterales salen a 0,85·v
    splitChildScale: 0.62
  },

  /* Empuje sostenido durante 25 pasos, no un impulso instantáneo. */
  rocket: {
    id: 'rocket',
    name: 'cohete',
    label: 'COHETE',
    color: '#e0796c',
    edge: '#8f3a2f',
    density: MATERIALS.bird.density,
    friction: MATERIALS.bird.friction,
    restitution: MATERIALS.bird.restitution,
    frictionAir: MATERIALS.bird.frictionAir,
    radiusScale: 1,
    launchScale: 1,
    thrustSteps: 25,
    thrustAccel: 0.22       // px/paso²; F = m·a/STEP² en cada paso
  }
};

/* Tipografía: p5 no siempre reaplica el tamaño con textSize(), así que
   se fija familia + tamaño juntos con textFont(familia, tamaño). */
const FONT_FAMILY = 'Trebuchet MS';

function useText(size, bold) {
  textStyle(bold ? BOLD : NORMAL);
  textFont(FONT_FAMILY, size);
}
