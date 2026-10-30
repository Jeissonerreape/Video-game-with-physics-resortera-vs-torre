/* =====================================================================
   Resortera vs. Torre — LÓGICA DEL JUEGO
   Motor físico: matter.js   ·   Render: p5.js
   ---------------------------------------------------------------------
   Flujo de una partida:
     ready -> aiming -> flying -> reloading -> ready ...
     (sin tiros) -> ending -> lost | won
   ===================================================================== */

/* ------------------------- utilidades ------------------------------ */
/* makeRng y las utilidades de semillas viven en js/rng.js. */

function distTo(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Diferencia angular normalizada a [-PI, PI]. */
function angleDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/**
 * Velocidades de los tres proyectiles de la división.
 * Las tres masas son iguales (m/3). Con los laterales a `k·v` y ±θ, la
 * central vale `s·v` con s = 3 − 2k·cos(θ), de modo que:
 *   Σ (m/3)·v_i = m·v   (momento vectorial exacto).
 */
function splitProjectileVelocities(vx, vy, cfg) {
  const t = cfg || AMMO_TYPES.split;
  const speed = Math.hypot(vx, vy);
  const base = Math.atan2(vy, vx);
  const k = t.splitSideSpeed;
  const th = t.splitAngle;
  const centerScale = 3 - 2 * k * Math.cos(th);
  const angles = [base - th, base, base + th];
  const magnitudes = [k * speed, centerScale * speed, k * speed];

  return angles.map((a, i) => ({
    vx: Math.cos(a) * magnitudes[i],
    vy: Math.sin(a) * magnitudes[i]
  }));
}

/** Distancia mínima de un punto a un segmento. */
function pointSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Distancia aproximada entre dos segmentos (suficiente para cortar cuerdas). */
function segmentsDistance(a, b, c, d) {
  return Math.min(
    pointSegDist(a.x, a.y, c.x, c.y, d.x, d.y),
    pointSegDist(b.x, b.y, c.x, c.y, d.x, d.y),
    pointSegDist(c.x, c.y, a.x, a.y, b.x, b.y),
    pointSegDist(d.x, d.y, a.x, a.y, b.x, b.y)
  );
}

/* --------------------------- juego -------------------------------- */

class Game {
  constructor(p5canvas, options = {}) {
    this.headless = !!options.headless;
    this.canvas = p5canvas;
    this.el = p5canvas.elt;
    this.W = CONFIG.WIDTH;
    this.H = CONFIG.HEIGHT;
    this.sfx = this.headless
      ? new Proxy({ muted: false }, {
        get: (target, key) => key in target ? target[key] : (() => {})
      })
      : new Sfx();
    this.theme = getTheme(1);
    this.themeActive = false;
    this.themeIntensity = 1;
    this.themeTransition = 0;
    this.activeFields = null;

    // --- motor físico -------------------------------------------------
    this.engine = Matter.Engine.create({
      positionIterations: 10,
      velocityIterations: 8,
      constraintIterations: 2
    });
    this.engine.gravity.x = 0;
    this.engine.gravity.y = CONFIG.GRAVITY;
    this.world = this.engine.world;

    // aceleración de la gravedad por paso (para predecir la trayectoria)
    // Matter integra: v += (fuerza/masa) * dt²  y  fuerza = masa*g*0.001
    this.gStep = 0.001 * CONFIG.GRAVITY * CONFIG.STEP_MS * CONFIG.STEP_MS;

    // --- progreso -----------------------------------------------------
    this.progress = this.headless
      ? {
        getLevel: () => ({ best: 0, stars: 0 }),
        recordLevel: (mode, id, result) => ({
          best: result.score, stars: result.stars, newBest: false, newStars: false
        }),
        unlockNext() {}
      }
      : new Progress();

    // --- pantallas ----------------------------------------------------
    // El juego arranca en el menú; el nivel clásico 1 se carga de fondo
    // para que el menú tenga la misma ambientación que la partida.
    this.screen = 'menu';
    this.runActive = false;
    this.screens = this.headless
      ? { screen: 'menu', update() {}, pointerDown() {}, pointerMove() {}, pointerUp() {} }
      : new Screens(this);

    // --- estado -------------------------------------------------------
    this.mode = 'classic';
    this.adventureLives = 5;
    this.adventureWorld = null;
    this.adventureLifeHeartsCollected = new Set();
    this.hardcoreRun = null;
    this.hardcoreFailure = '';
    this.hardcoreResult = null;
    this.infiniteRun = null;
    this.infiniteLastRun = null;
    this.infiniteNext = null;
    this.infinitePending = false;
    this.infiniteNextError = '';
    this.levelIndex = 0;
    this.levelNumber = 1;
    this.levelTotal = LEVELS.length;
    this.levelId = 'classic-1';
    this.levelName = LEVELS[0].name;
    this.levelWorld = 0;
    this.levelDef = LEVELS[0];
    this.levelMeta = {};
    this.level = LEVELS[0];
    this.entitySeedIndex = 0;
    this.particleSeedIndex = 0;
    this.levelShots = LEVELS[0].shots || 3;
    this.levelPar = Math.max(1, this.levelShots - 1);

    this.phase = 'ready';
    this.score = 0;
    this.best = 0;
    this.bestStars = 0;
    this.stars = 0;
    this.newBest = false;
    this.newStars = false;
    this.bonus = 0;
    this.shotsLeft = 0;
    this.shotsUsed = 0;
    this.shotsMax = 0;
    this.heartsCollected = 0;
    this.heartsTotal = 0;
    this.totalTargets = 0;

    this.blocks = [];
    this.targets = [];
    this.switches = [];
    this.hearts = [];
    this.ropes = [];
    this.levers = [];
    this.dominoes = [];
    this.boss = null;
    this.strayBirds = [];
    this.particles = [];
    this.popups = [];
    this.trail = [];
    this.doomed = [];
    this.bird = null;
    this.birds = [];           // proyectiles activos (puede haber 3 tras dividir)
    this.ammo = [];            // tipos pendientes, en orden de uso
    this.ammoUsed = [];        // tipos ya gastados (para el HUD)
    this.ammoIndex = 0;        // próximo tiro seleccionado dentro de `ammo`
    this.ammoHitboxes = [];    // zonas clicables del HUD (se rehacen al dibujar)
    this.shotStep = 0;
    this.lastBounceStep = -999;
    this.waves = [];           // ondas circulares de las explosiones

    this.goal = { type: 'destroyAll' };
    this.switchesTotal = 0;
    this.switchesActivated = 0;
    this.mechanismsTriggered = 0;
    this.dominoesTriggered = 0;
    this.showPhysics = false;

    // --- campos ambientales (viento, agua...) -------------------------
    this.fields = Fields.create(null);
    this.simStep = 0;          // pasos de física desde la carga del nivel
    this.fieldWork = 0;        // trabajo de los campos sobre el proyectil
    this.birdCollided = false; // deja de contar trabajo tras el primer choque
    this.lastSplashStep = -999;
    this.birdFerrous = false;  // el proyectil solo lo atraen los imanes si el nivel lo declara

    this.aim = { x: CONFIG.FORK.x, y: CONFIG.FORK.y };
    this.dragging = false;
    this.hover = false;
    this.cursor = '';

    this.accum = 0;
    this.flightTime = 0;
    this.reloadTimer = 0;
    this.endTimer = 0;
    this.graceTimer = 0;
    this.banner = 0;
    this.bannerText = '';
    this.shake = 0;
    this.time = 0;
    this.shotCount = 0;

    // --- decoración ---------------------------------------------------
    this.clouds = [
      { x: 180, y: 110, s: 1.00, v: 6, a: 190 },
      { x: 560, y: 68, s: 0.70, v: 4, a: 150 },
      { x: 910, y: 132, s: 1.15, v: 8, a: 175 },
      { x: 1190, y: 58, s: 0.62, v: 5, a: 135 },
      { x: -140, y: 186, s: 0.82, v: 7, a: 120 }
    ];
    this.grass = [];
    for (let i = 0; i < 90; i++) {
      this.grass.push({ x: (i * 137.5) % this.W, h: 6 + ((i * 53) % 11) });
    }
    this.pebbles = [];
    for (let i = 0; i < 34; i++) {
      this.pebbles.push({
        x: (i * 211.3) % this.W,
        y: CONFIG.GROUND_Y + 26 + ((i * 97) % 60),
        r: 2 + ((i * 31) % 6)
      });
    }

    if (!this.headless) this.buildSky();
    Matter.Events.on(this.engine, 'collisionStart', (evt) => this.onCollisionStart(evt));
    this.loadClassic(0);
  }

  /* ---------------------- carga de nivel --------------------------- */

  /**
   * Carga uno de los 6 niveles clásicos usando el mismo pipeline que la
   * Aventura. Los niveles clásicos no tienen id/par propios, así que se
   * generan aquí de forma estable.
   */
  loadClassic(index) {
    const i = clamp(index, 0, LEVELS.length - 1);
    const def = LEVELS[i];
    this.loadLevel(def, {
      mode: 'classic',
      id: def.id || `classic-${i + 1}`,
      index: i,
      number: i + 1,
      total: LEVELS.length,
      world: 0,
      par: def.par || Math.max(1, def.shots - 1)
    });
  }

  /** Entra al modo Clásico desde el menú. */
  startClassic(index) {
    this.mode = 'classic';
    this.screen = 'play';
    this.runActive = true;
    this.cursor = 'default';
    this.el.style.cursor = 'default';
    this.loadClassic(index);
  }

  /**
   * Entra a un nivel de Aventura. La definición ya viene resuelta por
   * `campaign.js`; aquí solo se monta el contexto de la partida.
   */
  startCampaignLevel(def, options = {}) {
    if (!def || !def.ready || !Array.isArray(def.bodies)) return false;

    if (!options.preserveLives) {
      this.adventureLives = 5;
      this.adventureLifeHeartsCollected = new Set();
    }
    this.adventureWorld = def.world;
    const world = getCampaignWorld(def.world);
    if (world) this.beginThemeTransition(world.tema);
    this.mode = 'adventure';
    this.screen = 'play';
    this.runActive = true;
    this.cursor = 'default';
    this.el.style.cursor = 'default';
    this.loadLevel(def, {
      mode: 'adventure',
      id: def.id,
      index: def.index - 1,
      number: def.index,
      total: 12,
      world: def.world,
      par: def.par,
      banner: def.boss
        ? `MUNDO ${def.world} · JEFE`
        : `MUNDO ${def.world} · NIVEL ${def.index}`
    });
    return true;
  }

  startHardcoreRun() {
    const run = this.progress.beginHardcoreRun();
    this.hardcoreRun = run;
    this.hardcoreFailure = '';
    this.hardcoreResult = null;
    return this.startHardcoreLevel(1, 1);
  }

  continueHardcoreRun() {
    const run = this.progress.data.hardcore.currentRun;
    if (!run) return false;
    this.hardcoreRun = Object.assign({}, run);
    this.hardcoreFailure = '';
    this.hardcoreResult = null;
    return this.startHardcoreLevel(run.world, run.level);
  }

  startHardcoreLevel(world, index) {
    const def = getCampaignLevel(world, index);
    if (!def || !def.ready || !this.hardcoreRun) return false;
    this.mode = 'hardcore';
    this.screen = 'play';
    this.runActive = true;
    this.cursor = 'default';
    this.el.style.cursor = 'default';
    this.loadLevel(def, {
      mode: 'hardcore',
      id: def.id,
      index: (world - 1) * 12 + index - 1,
      number: index,
      total: 60,
      world,
      par: def.par,
      theme: def.worldTheme,
      intensity: def.intensity,
      banner: this.hardcoreRun.levels === 0
        ? 'HARDCORE · UNA VIDA'
        : `HARDCORE · MUNDO ${world} · NIVEL ${index}`,
      bannerSub: 'UNA VIDA · MÍNIMO 3 ESTRELLAS · SIN REINICIO DE NIVEL',
      screen: 'play'
    });
    return true;
  }

  finishHardcoreRun() {
    if (!this.hardcoreRun || this.hardcoreResult) return;
    const result = this.progress.finishHardcoreRun(this.hardcoreRun);
    this.hardcoreResult = result;
  }

  startInfiniteRun(seed) {
    const parsedSeed = parseSeed32(seed);
    if (parsedSeed === null) return false;
    this.mode = 'infinite';
    this.screens.setScreen('infinite-loading');
    this.infiniteRun = {
      seed: parsedSeed,
      depth: 1,
      score: 0,
      stars: 0,
      reserve: CONFIG.INFINITE_STARTING_RESERVE,
      hearts: 0,
      levelScore: 0,
      levelStars: 0,
      mutator: null
    };
    this.progress.saveInfiniteRun(this.infiniteRun);
    this.infiniteNext = null;
    this.infinitePending = true;
    this.screens.notify('Preparando y comprobando el primer nivel…', 8);
    validateGenerated(parsedSeed, 1).then((generated) => {
      if (!this.infiniteRun || this.infiniteRun.seed !== parsedSeed || this.infiniteRun.depth !== 1) return;
      this.infinitePending = false;
      this.loadInfiniteLevel(generated);
    }).catch((error) => {
      this.infinitePending = false;
      this.infiniteNextError = error.message;
      console.error(error);
      if (this.infiniteRun && this.infiniteRun.seed === parsedSeed &&
          this.infiniteRun.depth === 1 && this.screen === 'infinite-loading') {
        this.screens.openInfinite();
      }
      this.screens.notify(`No se pudo generar el nivel: ${error.message}`, 8);
    });
    return true;
  }

  continueInfiniteRun() {
    const saved = this.progress.getInfiniteRun();
    if (!saved) return false;
    this.mode = 'infinite';
    this.screens.setScreen('infinite-loading');
    this.infiniteRun = Object.assign({
      hearts: 0,
      levelScore: 0,
      levelStars: 0,
      mutator: null
    }, saved);
    this.infiniteNext = null;
    this.infinitePending = true;
    validateGenerated(saved.seed, saved.depth).then((generated) => {
      if (!this.infiniteRun || this.infiniteRun.seed !== saved.seed ||
          this.infiniteRun.depth !== saved.depth) return;
      this.infinitePending = false;
      this.loadInfiniteLevel(generated);
    }).catch((error) => {
      this.infinitePending = false;
      this.infiniteNextError = error.message;
      console.error(error);
      if (this.infiniteRun && this.infiniteRun.seed === saved.seed &&
          this.infiniteRun.depth === saved.depth && this.screen === 'infinite-loading') {
        this.screens.openInfinite();
      }
      this.screens.notify(`No se pudo reanudar Infinito: ${error.message}`, 8);
    });
    return true;
  }

  loadInfiniteLevel(generated) {
    if (!generated || !this.infiniteRun) return false;
    const def = generatorClone(generated.def);
    const reserve = this.infiniteRun.reserve;
    def.shots += reserve;
    def.ammo = (def.ammo || []).slice();
    while (def.ammo.length < def.shots) def.ammo.push('normal');
    this.infiniteRun.mutator = generated.meta.mutator;
    this.mode = 'infinite';
    this.screens.setScreen('play');
    this.runActive = true;
    this.cursor = 'default';
    this.el.style.cursor = 'default';
    this.loadLevel(def, {
      mode: 'infinite',
      id: def.id,
      index: this.infiniteRun.depth - 1,
      number: this.infiniteRun.depth,
      total: Infinity,
      world: generated.meta.world,
      par: generated.def.par,
      theme: generated.meta.theme,
      intensity: generated.meta.intensity,
      reserveShots: reserve,
      mutator: generated.meta.mutator && generated.meta.mutator.id,
      gravityScale: generated.meta.mutator && generated.meta.mutator.gravityScale,
      massMultiplier: generated.meta.mutator && generated.meta.mutator.massMultiplier,
      screen: 'play',
      banner: `INFINITO · NIVEL ${this.infiniteRun.depth}`,
      bannerSub: generated.meta.mutator ? `MUTADOR · ${generated.meta.mutator.label}` : ''
    });
    this.levelId = def.id;
    this.infiniteRun.levelScore = 0;
    this.infiniteRun.levelStars = 0;
    this.infiniteNext = null;
    this.infiniteNextError = '';
    this.prepareInfiniteNext();
    return true;
  }

  prepareInfiniteNext() {
    if (!this.infiniteRun || this.infiniteNext || this.infinitePending) return;
    const run = this.infiniteRun;
    const seed = run.seed;
    const nextDepth = run.depth + 1;
    this.infinitePending = true;
    this.infiniteNextError = '';
    validateGenerated(seed, nextDepth).then((generated) => {
      // Si la run terminó o cambió mientras se validaba, el resultado ya no
      // pertenece a esta partida.
      if (this.infiniteRun !== run) return;
      this.infiniteNext = generated;
      this.infinitePending = false;
    }).catch((error) => {
      if (this.infiniteRun !== run) return;
      this.infinitePending = false;
      this.infiniteNextError = error.message;
      console.error(error);
      this.screens.notify(`Falló la validación del siguiente nivel: ${error.message}`, 8);
    });
  }

  finishInfiniteRun() {
    if (!this.infiniteRun) return;
    const finished = Object.assign({}, this.infiniteRun);
    this.infiniteLastRun = finished;
    this.progress.addInfiniteScore({
      seed: finished.seed,
      depth: finished.depth,
      score: finished.score,
      stars: finished.stars,
      date: new Date().toISOString().slice(0, 10)
    });
    this.infiniteRun = null;
    this.infiniteNext = null;
    this.infinitePending = false;
    this.infiniteNextError = '';
    this.progress.clearInfiniteRun();
    // La pantalla de resumen se dibuja sobre la partida; el jugador decide
    // cuándo pasar al ranking con un clic o con Espacio.
  }

  startThemeTest(worldId) {
    const world = getCampaignWorld(Number(worldId));
    if (!world) return false;
    const def = {
      name: `Prueba · ${world.nombre}`,
      hint: `Ambiente ${world.nombre} · intensidad ${world.intensidad.toFixed(2)}×`,
      shots: 4,
      par: 3,
      goal: { type: 'destroyAll' },
      fields: cloneLevelData(world.camposPrueba || null),
      bodies: [
        { t: 'box', mat: 'wood', x: 940, y: 610, w: 30, h: 80 },
        { t: 'target', x: 940, y: 560 }
      ]
    };
    this.beginThemeTransition(world.tema);
    this.mode = 'test';
    this.screen = 'play';
    this.screens.screen = 'play';
    this.runActive = true;
    this.loadLevel(def, {
      mode: 'test', id: `theme-${world.id}`, number: 1, total: 1,
      world: world.id, par: 3, theme: world.tema, intensity: world.intensidad,
      screen: 'play'
    });
    return true;
  }

  setTheme(themeId) {
    const next = getTheme(themeId);
    const changed = !this.theme || this.theme.id !== next.id;
    this.theme = next;
    if (changed && !this.headless) this.buildSky(next);
  }

  previewTheme(themeId) {
    this.themeActive = true;
    this.setTheme(themeId);
  }

  beginThemeTransition(themeId) {
    if (themeId) {
      this.themeActive = true;
      this.setTheme(themeId);
    }
    this.themeTransition = 0.3;
  }

  /**
   * Carga un nivel oculto de prueba (`window.TEST_LEVELS`) desde consola.
   * No aparece en ningún menú.
   */
  startTestLevel(name) {
    const def = window.TEST_LEVELS && window.TEST_LEVELS[name];
    if (!def) return false;

    this.mode = 'test';
    this.screen = 'play';
    this.screens.screen = 'play';
    this.runActive = true;
    this.cursor = 'default';
    this.el.style.cursor = 'default';
    this.loadLevel(def, {
      mode: 'test',
      id: `test-${name}`,
      index: 0,
      number: 1,
      total: 1,
      world: 0,
      par: Number.isFinite(def.par) ? def.par : 1,
      banner: `PRUEBA · ${def.name.toUpperCase()}`,
      screen: 'play'
    });
    return true;
  }

  /**
   * Lectura del test de Atwood de la primera polea del nivel activo.
   * Se puede llamar desde consola: game.measureAtwood().
   */
  measureAtwood(index) {
    const state = this.fields && this.fields.pulleys;
    if (!state || !state.pulleys || !state.pulleys.length) return null;
    const p = state.pulleys[Number(index) || 0];
    if (!p || !p.sides) return null;
    const theo = p.theoretical;
    const meas = p.measured;
    const error = Math.abs(theo) > 1e-9 ? (meas - theo) / theo : 0;
    return {
      theoretical: theo,
      measured: meas,
      errorPercent: error * 100,
      m1: p.sides.left.body.mass,
      m2: p.sides.right.body.mass,
      cut: p.cut
    };
  }

  /** Vuelve a una partida que se dejó en pausa con Esc. */
  resumeGame() {
    if (!this.canResume()) return;
    this.screen = 'play';
    this.screens.screen = 'play';
    this.el.style.cursor = 'default';
  }

  canResume() {
    return this.runActive && this.phase !== 'won' && this.phase !== 'lost';
  }

  /**
   * Punto único de carga para cualquier modo.
   *
   * `def`  es la definición de nivel (bodies, goal, shots, hint...).
   * `meta` describe la partida: modo, id, número, mundo, par, etc.
   *
   * La Aventura y el Infinito podrán pasar definiciones generadas sin
   * tocar esta función; el guardado se indexa por `levelId`.
   */
  loadLevel(def, meta = {}) {
    if (!def || !Array.isArray(def.bodies)) return;

    this.levelDef = def;
    this.level = def;
    this.levelMeta = Object.assign({}, meta);
    this.mode = meta.mode || this.mode || 'classic';
    this.engine.gravity.y = CONFIG.GRAVITY *
      (Number.isFinite(meta.gravityScale) ? meta.gravityScale : 1);

    // Carga desde consola (niveles de prueba): permite entrar directo a
    // la partida sin pasar por las pantallas.
    if (meta.screen === 'play') {
      this.screen = 'play';
      this.screens.screen = 'play';
      this.runActive = true;
      this.el.style.cursor = 'default';
    }

    this.levelIndex = Number.isFinite(meta.index) ? meta.index : 0;
    this.levelNumber = Number.isFinite(meta.number) ? meta.number : this.levelIndex + 1;
    this.levelTotal = Number.isFinite(meta.total) ? meta.total : LEVELS.length;
    this.levelWorld = Number.isFinite(meta.world) ? meta.world : 0;
    const campaignWorld = this.mode === 'adventure' || this.mode === 'hardcore'
      ? getCampaignWorld(this.levelWorld)
      : null;
    const themeSource = meta.theme || (campaignWorld && campaignWorld.tema);
    this.themeActive = !!themeSource;
    this.themeIntensity = Number.isFinite(meta.intensity)
      ? meta.intensity
      : (campaignWorld ? campaignWorld.intensidad : 1);
    if (themeSource) this.setTheme(themeSource);
    else this.restoreClassicTheme();
    this.levelName = def.name || `Nivel ${this.levelNumber}`;
    this.levelId = meta.id || def.id || `${this.mode}-${this.levelNumber}`;
    this.levelShots = def.shots || 3;
    this.levelPar = Number.isFinite(meta.par)
      ? meta.par
      : (Number.isFinite(def.par) ? def.par : Math.max(1, this.levelShots - 1));

    const record = this.progress.getLevel(this.mode, this.levelId);
    this.best = record.best;
    this.bestStars = record.stars;
    this.stars = 0;
    this.newBest = false;
    this.newStars = false;

    Matter.Composite.clear(this.world, false, true);

    this.blocks = [];
    this.targets = [];
    this.switches = [];
    this.hearts = [];
    this.ropes = [];
    this.levers = [];
    this.dominoes = [];
    this.boss = null;
    this.strayBirds = [];
    this.particles = [];
    this.popups = [];
    this.trail = [];
    this.doomed = [];
    this.bird = null;
    this.birds = [];
    this.ammoHitboxes = [];
    this.waves = [];
    this.lastBounceStep = -999;

    // Los campos que crean cuerpos (plataformas, poleas, hielo, espejos)
    // necesitan el mundo ya vacío y el mismo pipeline que los niveles.
    this.activeFields = Fields.scaleFields(def.fields, this.themeActive ? this.themeIntensity : 1);
    this.fields = Fields.create(this.activeFields, { game: this });
    this.entitySeedIndex = 0;
    this.particleSeedIndex = 0;
    this.birdFerrous = !!def.birdFerrous;
    this.simStep = 0;
    this.shotStep = 0;
    this.fieldWork = 0;
    this.birdCollided = false;
    this.lastSplashStep = -999;

    this.goal = def.goal || { type: 'destroyAll' };
    this.switchesTotal = 0;
    this.switchesActivated = 0;
    this.mechanismsTriggered = 0;
    this.dominoesTriggered = 0;

    this.score = 0;
    this.bonus = 0;
    this.initAmmo(def.ammo);
    this.shotsUsed = 0;
    this.heartsCollected = 0;
    this.heartsTotal = 0;
    this.shotCount = 0;
    this.phase = 'ready';
    this.dragging = false;
    this.aim = { x: CONFIG.FORK.x, y: CONFIG.FORK.y };
    this.flightTime = 0;
    this.reloadTimer = 0;
    this.endTimer = 0;
    this.graceTimer = CONFIG.GRACE;
    this.shake = 0;
    this.accum = 0;

    // suelo estático
    this.ground = Matter.Bodies.rectangle(
      this.W / 2, CONFIG.GROUND_Y + 160, 2600, 320,
      { isStatic: true, friction: 0.95, restitution: 0.02, label: 'ground' }
    );
    this.ground.game = { kind: 'ground' };
    Matter.Composite.add(this.world, this.ground);

    for (const bodyDef of def.bodies) {
      const body = this.makeBody(bodyDef);
      if (body) Matter.Composite.add(this.world, body);
    }

    // Corazones opcionales: se declaran aparte para no mezclarlos con
    // los cuerpos que forman la estructura.
    for (const [heartIndex, heartDef] of (def.hearts || []).entries()) {
      const body = this.makeBody(Object.assign({
        t: 'heart',
        lifeKey: `${this.levelId}:${heartDef.id || heartIndex}`
      }, heartDef));
      if (body) Matter.Composite.add(this.world, body);
    }
    this.heartsTotal = this.hearts.length;

    // Jefe final de mundo: sensor con vida, teletransporte y obstáculos.
    if (def.boss) {
      const bossBody = this.makeBoss(def.boss);
      if (bossBody) Matter.Composite.add(this.world, bossBody);
    }

    this.totalTargets = this.targets.length;
    this.switchesTotal = this.switches.length;
    this.bannerText = meta.banner ||
      `NIVEL ${this.levelNumber} · ${this.levelName.toUpperCase()}`;
    this.bannerSub = meta.bannerSub || def.hint || '';
    this.banner = this.bannerSub ? 4.2 : 2.8;
  }

  restoreClassicTheme() {
    this.themeActive = false;
    if (this.sky && !this.headless) this.buildSky(null);
  }

  /** Reinicia exactamente el nivel actual, conservando su contexto. */
  restartLevel() {
    if (this.mode === 'hardcore') return false;
    if (this.mode === 'adventure' && this.phase === 'lost' && this.adventureLives <= 0) {
      return this.restartAdventureWorld();
    }
    this.runActive = true;
    this.loadLevel(this.levelDef, this.levelMeta);
    return true;
  }

  restartAdventureWorld() {
    if (this.mode !== 'adventure') return false;
    if (this.adventureLives <= 0) {
      this.adventureLives = 5;
      this.adventureLifeHeartsCollected = new Set();
    }
    const world = this.adventureWorld || this.levelWorld;
    const first = getCampaignLevel(world, 1);
    if (!first || !first.ready) return false;
    return this.startCampaignLevel(first, { preserveLives: true });
  }

  /* ------------------------- munición ------------------------------- */

  /**
   * Construye la fila de munición. Sin `def.ammo` se mantiene el
   * comportamiento histórico: `shots` proyectiles normales.
   */
  initAmmo(source) {
    const shots = Math.max(1, Math.trunc(Number(this.levelShots)) || 1);
    let list;

    if (Array.isArray(source)) {
      list = source.filter((id) => !!AMMO_TYPES[id]).slice();
      if (list.length !== shots) {
        console.warn(
          `[ammo] ${this.levelId}: ammo.length=${source.length} no coincide ` +
          `con shots=${shots}; se ajusta con 'normal'.`
        );
        while (list.length < shots) list.push('normal');
        list = list.slice(0, shots);
      }
    } else {
      list = new Array(shots).fill('normal');
    }

    this.ammo = list;
    this.ammoUsed = [];
    this.ammoIndex = 0;
    this.shotsLeft = this.ammo.length;
    this.shotsMax = this.ammoUsed.length + this.ammo.length;
  }

  currentAmmoType() {
    return this.ammo[this.ammoIndex] || this.ammo[0] || 'normal';
  }

  availableAmmoTypes() {
    return Array.from(new Set(this.ammo));
  }

  /** Selecciona el primer tiro pendiente de ese tipo. */
  selectAmmoType(typeId) {
    const index = this.ammo.indexOf(typeId);
    if (index < 0) return false;
    if (index !== this.ammoIndex) {
      this.ammoIndex = index;
      this.sfx.reload();
    }
    return true;
  }

  selectAmmoIndex(index) {
    const i = Math.trunc(Number(index));
    if (!Number.isFinite(i) || i < 0 || i >= this.ammo.length) return false;
    if (i !== this.ammoIndex) {
      this.ammoIndex = i;
      this.sfx.reload();
    }
    return true;
  }

  /** Gasta el tiro seleccionado y deja preparado el siguiente. */
  consumeAmmo() {
    const type = this.ammo[this.ammoIndex] || 'normal';
    this.ammo.splice(this.ammoIndex, 1);
    this.ammoUsed.push(type);
    this.shotsLeft = this.ammo.length;
    if (this.ammoIndex >= this.ammo.length) {
      this.ammoIndex = Math.max(0, this.ammo.length - 1);
    }
    return type;
  }

  /** Clic/táctil sobre un icono de la fila o de la paleta 1–6. */
  pickAmmoAt(p) {
    for (const hit of this.ammoHitboxes) {
      if (p.x < hit.x || p.x > hit.x + hit.w) continue;
      if (p.y < hit.y || p.y > hit.y + hit.h) continue;
      return hit.index !== undefined
        ? this.selectAmmoIndex(hit.index)
        : this.selectAmmoType(hit.type);
    }
    return false;
  }

  /** Parámetros físicos del proyectil de un tipo. */
  ammoBodySpec(typeId) {
    const t = AMMO_TYPES[typeId] || AMMO_TYPES.normal;
    return {
      type: t,
      radius: CONFIG.BIRD_RADIUS * (t.radiusScale || 1),
      density: t.density * (this.levelMeta.massMultiplier || 1),
      friction: t.friction,
      frictionAir: t.frictionAir,
      restitution: t.restitution
    };
  }

  ammoRadius(typeId) {
    return this.ammoBodySpec(typeId).radius;
  }

  makeBody(def) {
    if (def.t === 'target') {
      const r = def.r || TARGET.radius;
      const body = Matter.Bodies.circle(def.x, def.y, r, {
        density: TARGET.density,
        friction: TARGET.friction,
        frictionStatic: 0.9,
        frictionAir: 0.008,
        restitution: Number.isFinite(def.restitution) ? def.restitution : TARGET.restitution,
        label: 'target'
      });
      body.game = {
        kind: 'target',
        mat: 'target',
        r: r,
        w: r * 2,
        h: r * 2,
        hp: this.levelMeta.mutator === 'fragile-targets'
          ? Math.max(1, Math.ceil(TARGET.hp * 0.6))
          : TARGET.hp,
        maxHp: this.levelMeta.mutator === 'fragile-targets'
          ? Math.max(1, Math.ceil(TARGET.hp * 0.6))
          : TARGET.hp,
        damageMult: TARGET.damageMult,
        seed: this.nextVisualSeed(def.x, def.y),
        hurt: 0,
        dead: false,
        removed: false
      };
      this.targets.push(body);
      if (def.mover !== undefined) this.attachToMover(body, def.mover);
      return body;
    }

    if (def.t === 'wheel') {
      const r = Math.max(8, Number(def.r) || 24);
      const mat = MATERIALS[def.mat] || MATERIALS.wood;
      const body = Matter.Bodies.circle(def.x, def.y, r, {
        density: def.density || mat.density,
        friction: Number.isFinite(def.friction) ? def.friction : mat.friction,
        frictionStatic: Number.isFinite(def.friction) ? def.friction : mat.friction,
        frictionAir: 0.006,
        restitution: Number.isFinite(def.restitution) ? def.restitution : mat.restitution,
        isStatic: !!def.isStatic,
        label: 'wheel'
      });
      if (def.hollow && Matter.Body.setInertia) {
        Matter.Body.setInertia(body, body.inertia * 2);
      }
      body.game = {
        kind: 'wheel',
        mat: def.mat || 'wood',
        r: r,
        w: r * 2,
        h: r * 2,
        hp: mat.hp,
        maxHp: mat.hp,
        damageMult: mat.damageMult,
        seed: Math.floor((Number(def.seed) || 0) + r * 31 + def.x * 17),
        hurt: 0,
        dead: false,
        removed: false,
        hollow: !!def.hollow
      };
      this.blocks.push(body);
      return body;
    }

    /* --- Corazón: sensor estático que solo recoge el proyectil -------- */
    if (def.t === 'heart') {
      const r = def.r || 22;
      const body = Matter.Bodies.circle(def.x, def.y, r, {
        isStatic: true,
        isSensor: true,
        label: 'heart'
      });
      body.game = {
        kind: 'heart',
        r: r,
        w: r * 2,
        h: r * 2,
        pulse: makeRng(this.nextVisualSeed(def.x, def.y))() * TWO_PI,
        collected: false,
        removed: false,
        lifeKey: def.lifeKey || null
      };
      this.hearts.push(body);
      return body;
    }

    /* --- Reactor: sensor estático que se activa al recibir un golpe --- */
    if (def.t === 'switch') {
      const r = def.r || 24;
      const body = Matter.Bodies.circle(def.x, def.y, r, {
        isStatic: true,
        isSensor: true,
        label: 'switch'
      });
      body.game = {
        kind: 'switch',
        id: def.id === undefined ? null : def.id,
        r: r,
        w: r * 2,
        h: r * 2,
        activated: false,
        requireChain: !!def.requireChain,
        pulse: 0
      };
      this.switches.push(body);
      return body;
    }

    /* --- Cuerda con peso: se puede cortar con el proyectil ---------- */
    if (def.t === 'rope') {
      const mat = MATERIALS[def.mat] || MATERIALS.stone;
      const r = def.r || 22;
      const length = def.length || 140;
      const body = Matter.Bodies.circle(def.x, def.y + length, r, {
        density: mat.density,
        friction: mat.friction,
        frictionStatic: mat.friction,
        frictionAir: 0.004,
        restitution: Number.isFinite(def.restitution) ? def.restitution : mat.restitution,
        label: 'weight'
      });
      body.game = {
        kind: 'weight',
        mat: def.mat || 'stone',
        r: r,
        w: r * 2,
        h: r * 2,
        hp: 420,
        maxHp: 420,
        damageMult: 0.15,
        seed: this.nextVisualSeed(def.x, def.y),
        hurt: 0,
        dead: false,
        removed: false,
        rope: null
      };
      this.blocks.push(body);
      Matter.Composite.add(this.world, body);

      const constraint = Matter.Constraint.create({
        pointA: { x: def.x, y: def.y },
        bodyB: body,
        pointB: { x: 0, y: 0 },
        length: length,
        stiffness: 0.95,
        damping: 0.08,
        render: { visible: false }
      });
      Matter.Composite.add(this.world, constraint);

      const rope = {
        anchor: { x: def.x, y: def.y },
        weight: body,
        constraint: constraint,
        length: length,
        cut: false
      };
      body.game.rope = rope;
      this.ropes.push(rope);
      return null;
    }

    /* --- Palanca: cuerpo rígido con un pivote fijo ------------------ */
    if (def.t === 'lever') {
      const mat = MATERIALS[def.mat] || MATERIALS.wood;
      const body = Matter.Bodies.rectangle(def.x, def.y, def.w, def.h, {
        density: def.density || mat.density,
        friction: Number.isFinite(def.friction) ? def.friction : mat.friction,
        frictionStatic: Number.isFinite(def.friction) ? def.friction : mat.friction,
        frictionAir: 0.006,
        restitution: Number.isFinite(def.restitution) ? def.restitution : mat.restitution,
        label: 'lever'
      });
      if (def.angle) Matter.Body.setAngle(body, def.angle);
      body.game = {
        kind: 'lever',
        mat: def.mat || 'wood',
        w: def.w,
        h: def.h,
        hp: 260,
        maxHp: 260,
        damageMult: 0.25,
        seed: this.nextVisualSeed(def.x, def.y),
        hurt: 0,
        dead: false,
        removed: false,
        baseAngle: body.angle,
        activated: false
      };
      this.blocks.push(body);
      Matter.Composite.add(this.world, body);

      const constraint = Matter.Constraint.create({
        pointA: { x: def.x, y: def.y },
        bodyB: body,
        pointB: { x: 0, y: 0 },
        length: 0,
        stiffness: 1,
        damping: 0.1,
        render: { visible: false }
      });
      Matter.Composite.add(this.world, constraint);
      this.levers.push({ body: body, constraint: constraint, activated: false });
      return null;
    }

    /* --- Cajas, dominós y piezas estáticas -------------------------- */
    const isDomino = def.t === 'domino';
    const mat = isDomino ? MATERIALS.domino : (MATERIALS[def.mat] || MATERIALS.wood);
    const body = Matter.Bodies.rectangle(def.x, def.y, def.w, def.h, {
      density: def.density || mat.density,
      friction: Number.isFinite(def.friction) ? def.friction : mat.friction,
      frictionStatic: Number.isFinite(def.friction) ? def.friction : mat.friction,
      frictionAir: 0.006,
      restitution: Number.isFinite(def.restitution) ? def.restitution : mat.restitution,
      isStatic: !!def.isStatic,
      label: isDomino ? 'domino' : def.mat
    });
    if (def.angle) Matter.Body.setAngle(body, def.angle);

    body.game = {
      kind: isDomino ? 'domino' : 'block',
      mat: isDomino ? 'domino' : def.mat,
      w: def.w,
      h: def.h,
      hp: mat.hp,
      maxHp: mat.hp,
      damageMult: isDomino ? 0.2 : mat.damageMult,
      seed: this.nextVisualSeed(def.x, def.y),
      hurt: 0,
      dead: false,
      removed: false,
      baseAngle: body.angle,
      triggered: false
    };
    body.ferrous = !!(def.ferrous || mat.ferrous);

    this.blocks.push(body);
    if (isDomino) this.dominoes.push(body);
    if (def.mover !== undefined) this.attachToMover(body, def.mover);
    return body;
  }

  nextVisualSeed(x, y) {
    const level = hash32((this.levelWorld + 1) >>> 0, (this.levelNumber + 1) >>> 0);
    const position = ((Math.floor(Number(x) || 0) * 31) +
      (Math.floor(Number(y) || 0) * 17)) >>> 0;
    return hash32(hash32(level, position), this.entitySeedIndex++);
  }

  /**
   * Asocia una pieza a una plataforma móvil. Las coordenadas del nivel son
   * absolutas en el instante de carga; se guarda el desplazamiento local y
   * la plataforma arrastra la pieza en cada paso.
   */
  attachToMover(body, id) {
    const state = this.fields && this.fields.movers;
    if (!body || !state || !state.byId) return;
    const mover = state.byId[String(id)];
    if (!mover || !mover.body) return;
    mover.rides.push({
      body: body,
      ox: body.position.x - mover.body.position.x,
      oy: body.position.y - mover.body.position.y,
      detached: false
    });
  }

  /**
   * Crea el jefe de mundo. Es un sensor estático con vida propia; al
   * recibir un golpe se teletransporta y añade un obstáculo a la arena.
   */
  makeBoss(def) {
    const slots = Array.isArray(def.slots) && def.slots.length
      ? def.slots
      : [[def.x || 1040, def.y || 300]];
    const start = slots[0];
    const r = def.r || 36;
    const body = Matter.Bodies.circle(start[0], start[1], r, {
      isStatic: true,
      isSensor: true,
      label: 'boss'
    });

    const maxHp = Math.max(1, Math.trunc(def.hp) || 3);
    this.boss = {
      kind: 'boss',
      body: body,
      r: r,
      hp: maxHp,
      maxHp: maxHp,
      slots: slots,
      slotIndex: 0,
      obstacles: Array.isArray(def.obstacles) ? def.obstacles.slice() : [],
      spawned: 0,
      invuln: 0,
      flash: 0,
      defeated: false,
      color: def.color || '#e0796c',
      name: def.name || 'El guardián',
      hitEffects: Array.isArray(def.hitEffects) ? def.hitEffects : [],
      hitCount: 0,
      motion: def.motion ? Object.assign({}, def.motion) : null
    };
    body.game = this.boss;
    return body;
  }

  /* ------------------------- entrada ------------------------------- */

  pointerDown(p) {
    this.sfx.ensure();

    if (this.screen !== 'play') {
      this.screens.pointerDown(p);
      return;
    }

    if (this.phase === 'won') { this.nextLevel(); return; }
    if (this.phase === 'lost') {
      if (this.mode === 'hardcore') this.screens.openHardcore();
      else if (this.mode === 'infinite') this.screens.openInfinite();
      else if (this.mode === 'adventure') this.restartLevel();
      else this.restartLevel();
      return;
    }

    // En vuelo, un clic/toque divide el proyectil si es de tipo `split`.
    if (this.phase === 'flying') {
      this.tryManualSplit();
      return;
    }

    // Selector de munición: los iconos del HUD se pueden tocar.
    if ((this.phase === 'ready' || this.phase === 'reloading') && this.pickAmmoAt(p)) {
      return;
    }

    if (this.phase !== 'ready') return;

    if (distTo(p.x, p.y, CONFIG.FORK.x, CONFIG.FORK.y) > CONFIG.GRAB_RADIUS) return;

    this.dragging = true;
    this.phase = 'aiming';
    this.aim.x = p.x;
    this.aim.y = p.y;
    this.clampAim();
  }

  pointerMove(p) {
    if (this.screen !== 'play') {
      this.hover = false;
      this.screens.pointerMove(p);
      return;
    }

    this.hover = this.phase === 'ready' &&
      distTo(p.x, p.y, CONFIG.FORK.x, CONFIG.FORK.y) <= CONFIG.GRAB_RADIUS;

    if (!this.dragging || this.phase !== 'aiming') return;
    this.aim.x = p.x;
    this.aim.y = p.y;
    this.clampAim();
  }

  pointerUp() {
    if (this.screen !== 'play') {
      this.screens.pointerUp();
      return;
    }

    if (!this.dragging) return;
    this.dragging = false;

    if (this.phase !== 'aiming') return;

    const stretch = distTo(this.aim.x, this.aim.y, CONFIG.FORK.x, CONFIG.FORK.y);
    if (stretch < CONFIG.MIN_STRETCH) {
      this.resetAim();
      return;
    }
    this.launch();
  }

  resetAim() {
    this.phase = 'ready';
    this.aim.x = CONFIG.FORK.x;
    this.aim.y = CONFIG.FORK.y;
    this.dragging = false;
  }

  clampAim() {
    const dx = this.aim.x - CONFIG.FORK.x;
    const dy = this.aim.y - CONFIG.FORK.y;
    const d = Math.hypot(dx, dy);
    if (d > CONFIG.MAX_STRETCH) {
      const k = CONFIG.MAX_STRETCH / d;
      this.aim.x = CONFIG.FORK.x + dx * k;
      this.aim.y = CONFIG.FORK.y + dy * k;
    }
  }

  /** Velocidad inicial: proporcional al estiramiento de la goma. */
  launchVector() {
    const dx = CONFIG.FORK.x - this.aim.x;
    const dy = CONFIG.FORK.y - this.aim.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) return { x: 0, y: 0 };
    const power = Math.min(d, CONFIG.MAX_STRETCH) / CONFIG.MAX_STRETCH;
    const type = AMMO_TYPES[this.currentAmmoType()] || AMMO_TYPES.normal;
    const speed = power * CONFIG.MAX_SPEED * (type.launchScale || 1);
    return { x: (dx / d) * speed, y: (dy / d) * speed };
  }

  launch() {
    const typeId = this.currentAmmoType();
    const type = AMMO_TYPES[typeId] || AMMO_TYPES.normal;
    const spec = this.ammoBodySpec(typeId);
    const v = this.launchVector();
    const speed = Math.hypot(v.x, v.y);
    if (speed < 0.5) { this.resetAim(); return; }

    // limpiar proyectiles anteriores (no acumular basura física)
    for (const old of this.strayBirds) Matter.Composite.remove(this.world, old);
    this.strayBirds = [];

    const bird = Matter.Bodies.circle(this.aim.x, this.aim.y, spec.radius, {
      density: spec.density,
      friction: spec.friction,
      frictionAir: spec.frictionAir,
      restitution: spec.restitution,
      label: 'bird'
    });
    const unit = speed > 0.001
      ? { x: v.x / speed, y: v.y / speed }
      : { x: 0, y: -1 };
    bird.game = {
      kind: 'bird',
      type: typeId,
      age: 0,
      splitUsed: false,
      exploded: false,
      pendingSplit: false,
      pendingExplode: null,
      thrustLeft: type.thrustSteps || 0,
      dir: unit
    };
    bird.ferrous = !!this.birdFerrous;
    Matter.Body.setVelocity(bird, v);
    Matter.Body.setAngularVelocity(bird, 0.10);
    Matter.Composite.add(this.world, bird);

    this.bird = bird;
    this.birds = [bird];
    this.trail = [{ x: bird.position.x, y: bird.position.y }];
    this.fieldWork = 0;
    this.birdCollided = false;
    this.shotStep = 0;
    this.consumeAmmo();
    this.shotsUsed++;
    this.shotCount++;
    this.phase = 'flying';
    this.flightTime = 0;
    this.shake = 3;
    this.sfx.launch(clamp(speed / CONFIG.MAX_SPEED, 0, 1));
    if (typeId === 'rocket') this.sfx.rocketIgnite();
    this.burstAt(this.aim.x, this.aim.y, 7, ['#ffd27a', '#ffe9b8'], 90);
  }

  /** Termina el vuelo actual y decide qué viene después. */
  resolveShot() {
    if (this.phase !== 'flying') return;

    const list = this.birds.length ? this.birds.slice() : (this.bird ? [this.bird] : []);
    for (const b of list) {
      if (b && b.game && !b.game.removed) this.strayBirds.push(b);
    }
    this.birds = [];
    this.bird = null;

    if (this.isGoalComplete()) {
      this.win();
      return;
    }

    if (this.shotsLeft > 0) {
      this.phase = 'reloading';
      this.reloadTimer = CONFIG.RELOAD;
      this.sfx.reload();
    } else {
      this.phase = 'ending';
      this.endTimer = CONFIG.SETTLE;
    }
  }

  /* --------------------- colisiones / daño -------------------------- */

  onCollisionStart(evt) {
    for (const pair of evt.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;

      // El trabajo de los campos deja de contarse en cuanto el proyectil
      // choca con algo sólido (los sensores no cuentan como choque).
      const birdHit =
        (a.game && a.game.kind === 'bird') ||
        (b.game && b.game.kind === 'bird');
      if (birdHit && !a.isSensor && !b.isSensor) this.birdCollided = true;

      // Los corazones se recogen con cualquier toque del proyectil,
      // incluso si llega despacio.
      if (this.tryCollectHeart(a, b) || this.tryCollectHeart(b, a)) continue;

      const rel = Matter.Vector.magnitude(Matter.Vector.sub(a.velocity, b.velocity));

      // Efectos propios del tipo de proyectil. Se aplazan al final del
      // paso para no mutar el mundo mientras matter.js recorre los pares.
      const ammoA = this.handleAmmoContact(a, b, rel);
      const ammoB = this.handleAmmoContact(b, a, rel);
      if (ammoA || ammoB) continue;

      if (rel < CONFIG.MIN_IMPACT_SPEED) continue;

      // El jefe es un sensor con vida: cada impacto válido resta un golpe.
      const bossA = this.tryHitBoss(a, b, rel);
      const bossB = this.tryHitBoss(b, a, rel);
      if (bossA || bossB) continue;

      // Los reactores son sensores: se activan, pero no reciben daño.
      const hitA = this.tryActivateSwitch(a, b, rel);
      const hitB = this.tryActivateSwitch(b, a, rel);
      if (hitA || hitB) continue;

      // Durante el asentamiento inicial no se aplica daño.
      if (this.graceTimer > 0) continue;

      // masa reducida: describe cuánto "pesa" el choque entre dos cuerpos
      const ma = a.mass;
      const mb = b.mass;
      const reduced = (2 * ma * mb) / (ma + mb);
      const impact = rel * reduced;

      if (impact > 14) {
        this.sfx.hit(clamp(impact / 80, 0.1, 1));
        this.shake = Math.max(this.shake, Math.min(10, impact / 14));
      }

      this.applyDamage(a, impact);
      this.applyDamage(b, impact);
    }
  }

  /**
   * Reacciones de los tipos especiales al tocar un cuerpo sólido.
   * Devuelve true si el impacto ya está consumido por el tipo (explosivo
   * o división); el rebote solo añade sonido y deja seguir el daño normal.
   */
  handleAmmoContact(body, other, rel) {
    const g = body && body.game;
    if (!g || g.kind !== 'bird' || !other || other.isSensor) return false;

    if (g.type === 'explosive') {
      if (!g.exploded && !g.pendingExplode &&
          rel >= AMMO_TYPES.explosive.blastMinSpeed) {
        g.pendingExplode = { x: body.position.x, y: body.position.y };
        return true;
      }
      return false;
    }

    if (g.type === 'split') {
      if (!g.splitUsed && !g.pendingSplit && rel >= 1.5) {
        g.pendingSplit = true;
        return true;
      }
      return false;
    }

    if (g.type === 'bounce' && rel > 1.2) {
      if (this.simStep - this.lastBounceStep > 4) {
        this.lastBounceStep = this.simStep;
        this.sfx.bounce();
      }
    }

    return false;
  }

  /** Recoge un corazón solo si el otro cuerpo es el proyectil. */
  tryCollectHeart(body, other) {
    const g = body.game;
    if (!g || g.kind !== 'heart' || g.collected) return false;
    if (!other || !other.game || other.game.kind !== 'bird') return false;
    this.collectHeart(body);
    return true;
  }

  collectHeart(body) {
    const g = body.game;
    if (!g || g.kind !== 'heart' || g.collected) return;

    g.collected = true;
    g.removed = true;
    this.heartsCollected++;
    const earnsLife = this.mode === 'adventure' && g.lifeKey &&
      !this.adventureLifeHeartsCollected.has(g.lifeKey);
    if (earnsLife) {
      this.adventureLifeHeartsCollected.add(g.lifeKey);
      this.adventureLives++;
    }

    // Los corazones añaden un tiro; en Aventura también pueden dar una vida.
    this.ammo.push('normal');
    this.shotsLeft = this.ammo.length;
    this.shotsMax = this.ammoUsed.length + this.ammo.length;

    // Si el corazón se recoge cuando el último tiro ya se estaba
    // resolviendo, el tiro extra debe poder usarse: se cancela la derrota.
    if (this.phase === 'ending') {
      this.phase = 'reloading';
      this.reloadTimer = CONFIG.RELOAD;
      this.endTimer = 0;
      this.sfx.reload();
    }

    const x = body.position.x;
    const y = body.position.y;
    this.addScore(CONFIG.SCORE_HEART, x, y - 28);
    this.popups.push({
      x: x,
      y: y - 52,
      text: earnsLife ? '♥ +1 VIDA · +1 TIRO' : '♥ +1 TIRO',
      life: 1.5,
      max: 1.5
    });
    this.burstAt(x, y, 30, ['#ff8fa8', '#ffd166', '#ffffff'], 210);
    this.sfx.heart();
    this.shake = Math.max(this.shake, 5);

    Matter.Composite.remove(this.world, body);
    this.hearts = this.hearts.filter((h) => h !== body);
  }

  /** Golpea al jefe solo con el proyectil y respetando la invulnerabilidad. */
  tryHitBoss(body, other, rel) {
    const g = body.game;
    if (!g || g.kind !== 'boss' || g.hp <= 0 || g.invuln > 0) return false;
    if (!other || !other.game || other.game.kind !== 'bird') return false;
    if (rel < CONFIG.MIN_IMPACT_SPEED) return false;
    this.hitBoss(g);
    return true;
  }

  hitBoss(g) {
    if (!g || g.kind !== 'boss' || g.hp <= 0) return;

    g.hp = Math.max(0, g.hp - 1);
    const hitIndex = g.hitCount++;
    g.flash = 0.22;
    g.invuln = 0.45;

    const x = g.body.position.x;
    const y = g.body.position.y;
    this.addScore(
      CONFIG.SCORE_BOSS_HIT * (this.mode === 'hardcore' ? 2 : 1),
      x,
      y - g.r - 24
    );
    this.burstAt(x, y, 36, [g.color, '#ffd166', '#ffffff'], 260);
    this.sfx.bossHit();
    this.shake = Math.max(this.shake, 12);

    const effect = g.hitEffects[hitIndex];
    if (effect) this.applyBossHitEffect(effect);
    if (g.motion && g.motion.type === 'orbit') {
      g.motion.omega += Math.max(0, Number(g.motion.acceleration) || 0);
    }

    if (g.hp <= 0) {
      g.defeated = true;
      this.burstAt(x, y, 70, [g.color, '#ffd166', '#ffffff', '#ff8fa8'], 340);
      this.checkWin();
      return;
    }

    // Teletransporte a la siguiente posición de la arena.
    g.slotIndex = (g.slotIndex + 1) % g.slots.length;
    const slot = g.slots[g.slotIndex];
    Matter.Body.setPosition(g.body, { x: slot[0], y: slot[1] });
    if (g.motion && g.motion.type === 'orbit') {
      const angle = Math.atan2(slot[1] - g.motion.y, slot[0] - g.motion.x);
      g.motion.phase = angle - g.motion.omega * this.simStep / 60;
    }

    // Cada golpe deja un obstáculo nuevo que obliga a cambiar el ángulo.
    const obstacleDef = g.obstacles[g.spawned];
    if (obstacleDef) {
      g.spawned++;
      const obstacle = this.makeBody(obstacleDef);
      if (obstacle) {
        Matter.Composite.add(this.world, obstacle);
        this.burstAt(obstacle.position.x, obstacle.position.y, 18, ['#a8b2bc', '#7d8791', '#ffffff'], 150);
      }
    }
  }

  applyBossHitEffect(effect) {
    if (effect.wind && this.fields.wind) {
      const wind = Object.assign({}, effect.wind);
      for (const key of ['fx', 'fy', 'gust']) {
        if (Number.isFinite(wind[key])) wind[key] *= this.themeIntensity;
      }
      Object.assign(this.fields.wind, wind);
      Object.assign(this.activeFields.wind, wind);
    }

    if (Number.isFinite(effect.waterRise) && this.fields.water) {
      this.fields.water.baseY = Math.max(
        120,
        this.fields.water.baseY - Math.max(0, effect.waterRise * this.themeIntensity)
      );
      this.fields.water.y = this.fields.water.baseY;
      this.activeFields.water.y = this.fields.water.baseY;
    }

    if (effect.mover && this.fields.movers) {
      const runtime = this.fields.movers.movers.find(
        (item) => String(item.id) === String(effect.mover.id)
      );
      const definition = this.activeFields.movers.find(
        (item) => String(item.id) === String(effect.mover.id)
      );
      const omega = Number(effect.mover.omega) * this.themeIntensity;
      if (runtime && Number.isFinite(omega)) runtime.omega = omega;
      if (definition && Number.isFinite(omega)) definition.omega = omega;
    }
  }

  updateBossMotion(step) {
    const motion = this.boss && this.boss.motion;
    if (!motion || this.boss.hp <= 0) return;
    if (motion.type === 'orbit') {
      const angle = motion.omega * step / 60 + motion.phase;
      Matter.Body.setPosition(this.boss.body, {
        x: motion.x + Math.cos(angle) * motion.radius,
        y: motion.y + Math.sin(angle) * motion.radius
      });
    } else if (motion.type === 'platform' && this.fields.movers) {
      const mover = this.fields.movers.byId[String(motion.moverId)];
      if (!mover || !mover.body) return;
      Matter.Body.setPosition(this.boss.body, {
        x: mover.body.position.x + (Number(motion.offsetX) || 0),
        y: mover.body.position.y + (Number(motion.offsetY) || 0)
      });
    }
  }

  /** Devuelve true si `body` es un reactor y el choque lo activa. */
  tryActivateSwitch(body, other, rel) {
    const g = body.game;
    if (!g || g.kind !== 'switch' || g.activated) return false;
    if (!other || other.isStatic || !other.game) return false;
    if (g.requireChain && other.game.kind === 'bird') return false;
    if (other.mass < CONFIG.SWITCH_MIN_MASS) return false;
    if (rel < CONFIG.SWITCH_MIN_SPEED) return false;

    this.activateSwitch(body, other);
    return true;
  }

  activateSwitch(body, other) {
    const g = body.game;
    if (!g || g.activated) return;

    g.activated = true;
    g.pulse = 1;
    this.switchesActivated++;
    this.addScore(CONFIG.SCORE_SWITCH, body.position.x, body.position.y - 34);
    this.burstAt(body.position.x, body.position.y, 28, ['#8ff09b', '#5ce27a', '#ffffff'], 230);
    this.sfx.switchOn();
    this.shake = Math.max(this.shake, 10);

    if (this.dominoesTriggered > 0) {
      this.popups.push({
        x: body.position.x,
        y: body.position.y - 70,
        text: `CADENA x${this.dominoesTriggered}`,
        life: 1.4,
        max: 1.4
      });
    }
  }

  applyDamage(body, impact) {
    const g = body.game;
    if (!g || !g.hp || g.dead || g.removed) return;
    if (body.isStatic || g.kind === 'switch') return;

    const dmg = impact * CONFIG.DAMAGE_K * (g.damageMult || 1);
    if (dmg < CONFIG.MIN_DAMAGE) return;

    g.hp -= dmg;
    g.hurt = 0.18;

    if (g.hp <= 0) {
      g.hp = 0;
      g.dead = true;
      this.doomed.push(body);
    }
  }

  flushDoomed() {
    if (!this.doomed.length) return;
    const list = this.doomed;
    this.doomed = [];
    for (const b of list) this.removeBody(b, 'destroyed');
  }

  removeBody(body, reason) {
    const g = body.game;
    if (!g || g.removed) return;
    g.removed = true;

    Matter.Composite.remove(this.world, body);

    // Limpieza de mecanismos asociados
    if (g.kind === 'weight' && g.rope && !g.rope.cut) {
      this.cutRope(g.rope, false, body.position.x, body.position.y);
    }
    if (g.kind === 'lever') {
      const lv = this.levers.find(l => l.body === body);
      if (lv && lv.constraint) Matter.Composite.remove(this.world, lv.constraint);
      this.levers = this.levers.filter(l => l.body !== body);
    }
    if (g.kind === 'domino') {
      this.dominoes = this.dominoes.filter(d => d !== body);
    }
    if (g.kind === 'switch') {
      this.switches = this.switches.filter(s => s !== body);
      this.switchesTotal = Math.max(0, this.switchesTotal - 1);
    }

    const bi = this.blocks.indexOf(body);
    if (bi >= 0) this.blocks.splice(bi, 1);
    const ti = this.targets.indexOf(body);
    if (ti >= 0) this.targets.splice(ti, 1);

    if (g.kind === 'target') {
      this.addScore(CONFIG.SCORE_TARGET, body.position.x, body.position.y - 24);
      this.burstBody(body, ['#7fd45c', '#4d9c33', '#ffffff'], 20);
      this.sfx.pop();
      this.shake = Math.max(this.shake, 7);
    } else if (g.kind === 'block') {
      if (g.mat === 'ice' || g.ice) {
        // El hielo no da puntos al derretirse: libera lo que sostenía.
        if (reason === 'destroyed') this.sfx.shatter();
      } else if (reason === 'destroyed') {
        this.addScore(CONFIG.SCORE_BLOCK, body.position.x, body.position.y - 16);
        this.sfx.breakBlock();
      }
      const colors = this.materialColors(g.mat);
      this.burstBody(body, colors, reason === 'destroyed' ? 16 : 8);
    } else if (g.kind === 'weight' || g.kind === 'lever' || g.kind === 'domino') {
      const colors = this.materialColors(g.mat);
      this.burstBody(body, colors, 12);
    }
  }

  materialColors(mat) {
    if (mat === 'stone') return ['#a8b2bc', '#7d8791', '#5f6973'];
    if (mat === 'glass') return ['#d6f2ff', '#9fd9f2', '#ffffff'];
    if (mat === 'ice') return ['#d6f2ff', '#9fd9f2', '#ffffff'];
    if (mat === 'steel') return ['#c2ccd6', '#8f9ca9', '#5f6b78'];
    if (mat === 'domino') return ['#efe3c4', '#d8c69c', '#b49a66'];
    return ['#c1854f', '#a26a3a', '#7d4f27'];
  }

  /* -------------------------- update ------------------------------- */

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    if (this.themeTransition > 0) {
      this.themeTransition = Math.max(0, this.themeTransition - dt);
    }
    if (this.screens) this.screens.update(dt);

    const inPlay = this.screen === 'play';
    const active = inPlay && this.phase !== 'won' && this.phase !== 'lost';

    if (inPlay) {
      if (this.banner > 0) this.banner -= dt;
      if (this.graceTimer > 0) this.graceTimer -= dt;
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 34);

    if (active) {
      this.accum += dt * 1000;
      let steps = 0;
      while (this.accum >= CONFIG.STEP_MS && steps < CONFIG.MAX_STEPS) {
        const prevBirds = this.birds.map((b) => ({
          body: b,
          x: b.position.x,
          y: b.position.y
        }));
        const birdBefore = this.bird
          ? {
            body: this.bird,
            x: this.bird.position.x,
            y: this.bird.position.y,
            vx: this.bird.velocity.x,
            vy: this.bird.velocity.y
          }
          : null;

        // Orden por paso: campos + cohete -> Matter -> colisiones
        // (eventos) -> efectos diferidos -> mecanismos.
        this.applyAmmoForces();
        if (Fields.has(this.fields)) {
          Fields.apply(this.fields, this.world.bodies, this.simStep, { bird: this.bird });
        }
        this.updateBossMotion(this.simStep);

        Matter.Engine.update(this.engine, CONFIG.STEP_MS);
        this.simStep++;
        this.shotStep++;
        this.afterAmmoStep();

        if (Fields.has(this.fields)) {
          this.updateFieldWork(birdBefore);
          this.consumeFieldEvents();
          Fields.afterUpdate(this.fields);
        }

        for (const prev of prevBirds) {
          const b = prev.body;
          if (!b || !b.game || b.game.removed) continue;
          this.checkRopeCuts(prev, {
            x: b.position.x,
            y: b.position.y
          }, b);
        }
        if (Fields.has(this.fields) && this.phase === 'flying') {
          this.consumeFieldEvents();
        }

        this.accum -= CONFIG.STEP_MS;
        steps++;
      }
      if (steps === CONFIG.MAX_STEPS) this.accum = 0;

      this.flushDoomed();
      this.updateBodyTimers(dt);
      this.updateMechanisms(dt);
      this.removeFallenBodies();
      this.updateShotState(dt);
      this.checkWin();
    }

    this.updateClouds(dt);
    this.updateParticles(dt);
    this.updatePopups(dt);
    this.updateWaves(dt);

    // cursor
    if (inPlay) {
      const wanted = this.hover && this.phase === 'ready' ? 'grab' : 'default';
      if (wanted !== this.cursor) {
        this.cursor = wanted;
        this.el.style.cursor = wanted;
      }
    }
  }

  updateBodyTimers(dt) {
    for (const b of this.blocks) if (b.game.hurt > 0) b.game.hurt -= dt;
    for (const t of this.targets) if (t.game.hurt > 0) t.game.hurt -= dt;
    if (this.boss) {
      if (this.boss.invuln > 0) this.boss.invuln = Math.max(0, this.boss.invuln - dt);
      if (this.boss.flash > 0) this.boss.flash = Math.max(0, this.boss.flash - dt);
    }
  }

  /**
   * Trabajo de los campos sobre el proyectil, calculado como la diferencia
   * de energía cinética menos el trabajo de la gravedad. Así se incluyen
   * tanto las fuerzas explícitas (viento, empuje) como el arrastre del agua.
   * Se detiene en el primer choque para no mezclar impulsos de colisión.
   */
  updateFieldWork(before) {
    if (!before || !this.bird || this.bird !== before.body || this.birdCollided) return;
    const b = this.bird;
    const v0 = Math.hypot(before.vx, before.vy);
    const v1 = Math.hypot(b.velocity.x, b.velocity.y);
    const ec0 = 0.5 * b.mass * v0 * v0;
    const ec1 = 0.5 * b.mass * v1 * v1;
    const gravWork = b.mass * this.gStep * (b.position.y - before.y);
    this.fieldWork += ec1 - ec0 - gravWork;
  }

  /** Convierte los eventos de los campos en partículas, puntos y sonido. */
  consumeFieldEvents() {
    const events = Fields.takeEvents(this.fields);
    for (const evt of events) {
      if (evt.type === 'splash') {
        this.splashAt(evt.x, evt.y, evt.strength);
      } else if (evt.type === 'ropeCut') {
        this.mechanismsTriggered++;
        this.addScore(CONFIG.SCORE_MECHANISM, evt.x, evt.y - 24);
        this.burstAt(evt.x, evt.y, 12, ['#d8b98a', '#8a6a45', '#ffffff'], 150);
        this.sfx.ropeCut();
        this.shake = Math.max(this.shake, 4);
      } else if (evt.type === 'magnetHum') {
        this.sfx.magnetHum();
      } else if (evt.type === 'magnetOn') {
        if (evt.on) this.sfx.magnetHum();
        this.burstAt(evt.x, evt.y, 14, ['#bdefff', '#8fdcff', '#ffffff'], 140);
      } else if (evt.type === 'pulleyTick') {
        this.sfx.pulleyTick();
      } else if (evt.type === 'crackle') {
        this.sfx.crackle();
      } else if (evt.type === 'fireOn') {
        if (evt.on) {
          this.sfx.crackle();
          this.burstAt(evt.x, evt.y, 18, ['#ffb347', '#ff7a45', '#ffe6a8'], 170);
        }
      } else if (evt.type === 'laserPulse') {
        this.sfx.laser();
      } else if (evt.type === 'laserTarget') {
        this.setLaserTarget(evt.id, evt.lit, evt.x, evt.y);
      } else if (evt.type === 'iceMelt') {
        this.meltIce(evt.body, evt.x, evt.y);
      } else if (evt.type === 'resonanceBreak') {
        this.popups.push({
          x: evt.x,
          y: evt.y - 34,
          text: '¡FATIGA!',
          life: 1.3,
          max: 1.3
        });
        this.burstAt(evt.x, evt.y, 28, ['#bdefff', '#c2ccd6', '#ffffff'], 210);
        this.sfx.shatter();
        this.shake = Math.max(this.shake, 7);
      }
    }
  }

  /** Un reactor iluminado por un láser se activa; si deja de recibir luz,
      se apaga solo si fue el láser quien lo encendió. */
  setLaserTarget(id, lit, x, y) {
    const body = this.switches.find(
      (s) => s.game && String(s.game.id) === String(id)
    );
    if (!body) return;
    const g = body.game;

    if (lit) {
      g.laserControlled = true;
      if (!g.activated) {
        if (!g.laserScored) {
          g.laserScored = true;
          this.activateSwitch(body, null);
        } else {
          g.activated = true;
          g.pulse = 1;
          this.switchesActivated++;
        }
      }
    } else if (g.laserControlled && g.activated) {
      g.activated = false;
      g.pulse = 0;
      this.switchesActivated = Math.max(0, this.switchesActivated - 1);
      this.popups.push({
        x: x || body.position.x,
        y: (y || body.position.y) - 38,
        text: 'RAYO CORTADO',
        life: 1.2,
        max: 1.2
      });
    }
  }

  /** Derrite un bloque de hielo: gotas, sonido y liberación de la carga. */
  meltIce(body, x, y) {
    if (!body || !body.game || body.game.removed) return;
    body.game.melted = true;
    this.removeBody(body, 'melt');
    this.burstAt(x, y, 24, ['#d6f2ff', '#9fd9f2', '#ffffff'], 150);
    this.sfx.crackle();
    this.shake = Math.max(this.shake, 3);
  }

  /** Burbujas y chapoteo al entrar un cuerpo rápido en el agua. */
  splashAt(x, y, strength) {
    const rng = makeRng(
      (this.simStep * 2654435761 + Math.floor(x) * 97 + Math.floor(y)) >>> 0
    );
    const count = Math.round(6 + strength * 16);
    const colors = ['#d6f2ff', '#9fd9f2', '#ffffff', '#7fc9dd'];

    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 1.9;
      const speed = 28 + rng() * (70 + 130 * strength);
      this.particles.push({
        x: x + (rng() - 0.5) * 26,
        y: y + 3 + rng() * 16,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.45 + rng() * 0.7,
        max: 1.15,
        size: 2.5 + rng() * 4.5,
        color: colors[Math.floor(rng() * colors.length)],
        rot: 0,
        vrot: 0,
        square: false,
        rise: true
      });
    }

    if (this.simStep - this.lastSplashStep > 3) {
      this.lastSplashStep = this.simStep;
      this.sfx.splash(clamp(strength, 0.1, 1));
    }
    this.shake = Math.max(this.shake, strength * 3);
  }

  /* --------------------- mecanismos / cuerdas ---------------------- */

  updateMechanisms(dt) {
    // Palancas: se activan cuando giran lo suficiente.
    for (const lv of this.levers) {
      const b = lv.body;
      const g = b.game;
      if (!g || g.removed || g.activated) continue;
      if (Math.abs(angleDelta(b.angle, g.baseAngle)) > CONFIG.LEVER_ANGLE) {
        g.activated = true;
        lv.activated = true;
        this.mechanismsTriggered++;
        this.addScore(CONFIG.SCORE_MECHANISM, b.position.x, b.position.y - 30);
        this.sfx.lever();
        this.burstBody(b, ['#ffd166', '#ffffff'], 12);
      }
    }

    // Dominós: cada ficha caída suma cadena y puntos.
    for (const d of this.dominoes) {
      const g = d.game;
      if (!g || g.removed || g.triggered) continue;
      if (Math.abs(angleDelta(d.angle, g.baseAngle)) > CONFIG.DOMINO_ANGLE) {
        g.triggered = true;
        this.dominoesTriggered++;
        this.addScore(CONFIG.SCORE_DOMINO);
        this.sfx.domino();
      }
    }

    // Pulso visual de los reactores.
    for (const s of this.switches) {
      if (s.game.pulse > 0) s.game.pulse = Math.max(0, s.game.pulse - dt * 1.6);
    }
  }

  /** Corta una cuerda si un proyectil atraviesa su segmento. */
  checkRopeCuts(prev, curr, bird) {
    const b = bird || this.bird;
    if (!b || !b.game || b.game.removed) return;
    const speed = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (speed < CONFIG.ROPE_CUT_SPEED) return;

    for (const rope of this.ropes) {
      if (rope.cut || !rope.weight || rope.weight.game.removed) continue;

      const anchor = rope.anchor;
      const weight = rope.weight.position;
      const dist = segmentsDistance(prev, curr, anchor, weight);
      const nearWeight =
        Math.hypot(curr.x - weight.x, curr.y - weight.y) <
        b.circleRadius + rope.weight.circleRadius + 4;

      if (dist <= b.circleRadius + CONFIG.ROPE_CUT_PAD || nearWeight) {
        this.cutRope(rope, true, weight.x, Math.min(weight.y, (anchor.y + weight.y) / 2));
        break;
      }
    }

    // Las poleas usan el mismo segmento barrido que las cuerdas clásicas.
    if (Fields.has(this.fields)) {
      Fields.checkCuts(this.fields, prev, curr, { radius: b.circleRadius });
    }
  }

  cutRope(rope, giveScore, x, y) {
    if (!rope || rope.cut) return;
    rope.cut = true;

    if (rope.constraint) {
      Matter.Composite.remove(this.world, rope.constraint);
      rope.constraint = null;
    }

    if (giveScore) {
      this.mechanismsTriggered++;
      this.addScore(CONFIG.SCORE_MECHANISM, x, y - 24);
      this.sfx.ropeCut();
      this.shake = Math.max(this.shake, 4);
    }

    this.burstAt(x, y, 12, ['#d8b98a', '#8a6a45', '#ffffff'], 150);
  }

  removeFallenBodies() {
    const floor = CONFIG.GROUND_Y + 240;
    for (const b of this.blocks.slice()) {
      if (b.isStatic) continue;
      if (b.position.y > floor || b.position.x < -400 || b.position.x > this.W + 500) {
        this.removeBody(b, 'fell');
      }
    }
    for (const t of this.targets.slice()) {
      if (t.position.y > floor || t.position.x < -400 || t.position.x > this.W + 500) {
        this.removeBody(t, 'fell');
      }
    }
  }

  updateShotState(dt) {
    if (this.phase === 'flying') {
      this.flightTime += dt;

      if (this.bird && this.bird.game && !this.bird.game.removed) {
        this.trail.push({ x: this.bird.position.x, y: this.bird.position.y });
        if (this.trail.length > 26) this.trail.shift();
      }

      // Un disparo termina cuando todos sus proyectiles están en reposo,
      // han caído fuera o se agota MAX_FLIGHT (también tras dividirse).
      const alive = [];
      let moving = 0;

      for (const b of this.birds.slice()) {
        if (!b || !b.game || b.game.removed) continue;
        const speed = Matter.Vector.magnitude(b.velocity);
        const resting = speed < CONFIG.REST_SPEED && this.flightTime > 0.9;
        const lost = b.position.y > CONFIG.GROUND_Y + 260 ||
          b.position.x < -400 || b.position.x > this.W + 500;

        if (lost) {
          Matter.Composite.remove(this.world, b);
          b.game.removed = true;
          continue;
        }

        alive.push(b);
        if (!resting) moving++;
      }

      this.birds = alive;
      if (!this.birds.includes(this.bird)) this.bird = this.birds[0] || null;

      if (!this.birds.length || moving === 0 || this.flightTime > CONFIG.MAX_FLIGHT) {
        this.resolveShot();
      }
    }

    if (this.phase === 'reloading') {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.phase = 'ready';
        this.aim.x = CONFIG.FORK.x;
        this.aim.y = CONFIG.FORK.y;
      }
    }

    if (this.phase === 'ending') {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.lose();
    }
  }

  /* ------------------- proyectiles especiales ---------------------- */

  /** Empuje sostenido del cohete (antes de cada paso de matter.js). */
  applyAmmoForces() {
    for (const b of this.birds) {
      const g = b && b.game;
      if (!g || g.removed || g.type !== 'rocket' || g.thrustLeft <= 0) continue;

      const speed = Math.hypot(b.velocity.x, b.velocity.y);
      if (speed > 0.05) {
        g.dir = { x: b.velocity.x / speed, y: b.velocity.y / speed };
      }
      const dir = g.dir || { x: 0, y: -1 };
      const accel = AMMO_TYPES.rocket.thrustAccel;
      const force = b.mass * accel / (CONFIG.STEP_MS * CONFIG.STEP_MS);

      Matter.Body.applyForce(b, b.position, {
        x: dir.x * force,
        y: dir.y * force
      });
      g.thrustLeft--;
      this.spawnRocketSmoke(b, dir);
    }
  }

  /** Efectos diferidos del paso: edad, explosión y división. */
  afterAmmoStep() {
    if (this.phase !== 'flying') return;

    for (const b of this.birds.slice()) {
      if (b && b.game && !b.game.removed) b.game.age++;
    }

    for (const b of this.birds.slice()) {
      if (b && b.game && b.game.pendingExplode) {
        this.explodeBird(b, b.game.pendingExplode);
        return;
      }
    }

    for (const b of this.birds.slice()) {
      if (b && b.game && b.game.pendingSplit) {
        this.performSplit(b);
        break;
      }
    }

    const primary = this.bird;
    if (primary && primary.game && primary.game.type === 'split' &&
        !primary.game.splitUsed && !primary.game.removed &&
        primary.game.age >= AMMO_TYPES.split.splitDelay) {
      this.performSplit(primary);
    }
  }

  /** Humo procedural del cohete, con RNG derivado del paso. */
  spawnRocketSmoke(bird, dir) {
    const seed = (
      this.simStep * 2654435761 +
      Math.floor(bird.position.x * 13) +
      bird.game.thrustLeft * 97
    ) >>> 0;
    const rng = makeRng(seed);
    const back = bird.circleRadius + 4;

    for (let i = 0; i < 2; i++) {
      const spread = (rng() - 0.5) * 34;
      this.particles.push({
        x: bird.position.x - dir.x * back + (rng() - 0.5) * 8,
        y: bird.position.y - dir.y * back + (rng() - 0.5) * 8,
        vx: -dir.x * (22 + rng() * 34) + spread,
        vy: -dir.y * (22 + rng() * 34) - 12,
        life: 0.42 + rng() * 0.38,
        max: 0.8,
        size: 5 + rng() * 6,
        color: rng() < 0.5 ? '#e9e4de' : '#c9c4be',
        rot: 0,
        vrot: 0,
        square: false,
        smoke: true,
        grow: 22 + rng() * 16
      });
    }
  }

  canSplit() {
    const b = this.bird;
    return !!(this.phase === 'flying' && b && b.game &&
      b.game.kind === 'bird' && b.game.type === 'split' &&
      !b.game.splitUsed && !b.game.removed);
  }

  tryManualSplit() {
    if (!this.canSplit()) return false;
    return this.performSplit(this.bird);
  }

  /**
   * Divide el proyectil en tres. Los tres hijos tienen masa m/3 y sus
   * velocidades cumplen Σ (m/3)·v_i = m·v (ver splitProjectileVelocities).
   */
  performSplit(bird) {
    if (!bird || !bird.game || bird.game.type !== 'split' ||
        bird.game.splitUsed || bird.game.removed) return false;

    const speed = Math.hypot(bird.velocity.x, bird.velocity.y);
    if (speed < 0.5) return false;

    const cfg = AMMO_TYPES.split;
    const spec = this.ammoBodySpec('split');
    const velocities = splitProjectileVelocities(bird.velocity.x, bird.velocity.y, cfg);
    const childRadius = bird.circleRadius * cfg.splitChildScale;
    const childMass = bird.mass / velocities.length;
    const perp = { x: -bird.velocity.y / speed, y: bird.velocity.x / speed };
    const base = { x: bird.position.x, y: bird.position.y };
    const children = [];

    for (let i = 0; i < velocities.length; i++) {
      const side = i === 1 ? 0 : (i === 0 ? -1 : 1);
      const x = base.x + perp.x * side * (childRadius + 2);
      const y = base.y + perp.y * side * (childRadius + 2);
      const child = Matter.Bodies.circle(x, y, childRadius, {
        density: spec.density,
        friction: spec.friction,
        frictionAir: spec.frictionAir,
        restitution: spec.restitution,
        label: 'bird'
      });
      const before = child.mass;
      Matter.Body.setMass(child, childMass);
      if (Matter.Body.setInertia) {
        Matter.Body.setInertia(child, child.inertia * (childMass / before));
      }

      const v = velocities[i];
      const mag = Math.hypot(v.vx, v.vy) || 1;
      child.game = {
        kind: 'bird',
        type: 'split',
        age: bird.game.age,
        splitUsed: true,
        exploded: false,
        pendingSplit: false,
        pendingExplode: null,
        thrustLeft: 0,
        dir: { x: v.vx / mag, y: v.vy / mag }
      };
      child.ferrous = !!bird.ferrous;
      Matter.Body.setVelocity(child, { x: v.vx, y: v.vy });
      Matter.Body.setAngularVelocity(child, (i - 1) * 0.12);
      Matter.Composite.add(this.world, child);
      children.push(child);
    }

    Matter.Composite.remove(this.world, bird);
    bird.game.removed = true;

    this.birds = children;
    this.bird = children[1] || children[0];
    this.trail = [{ x: base.x, y: base.y }];
    this.sfx.split();
    this.burstAt(base.x, base.y, 18, ['#d8b8f2', '#b07cd8', '#ffffff'], 170);
    this.shake = Math.max(this.shake, 4);
    return true;
  }

  /** Explosión: daño y fuerza radial, onda, partículas y sacudida. */
  explodeBird(bird, point) {
    if (!bird || !bird.game || bird.game.exploded) return;

    bird.game.exploded = true;
    const cfg = AMMO_TYPES.explosive;
    const x = point ? point.x : bird.position.x;
    const y = point ? point.y : bird.position.y;

    Matter.Composite.remove(this.world, bird);
    bird.game.removed = true;
    this.birds = this.birds.filter((b) => b !== bird);
    if (this.bird === bird) this.bird = this.birds[0] || null;

    this.applyBlast(this.world, x, y, cfg, bird);
    this.waves.push({
      x: x,
      y: y,
      r: 12,
      radius: cfg.blastRadius,
      life: 0.52,
      max: 0.52
    });

    this.burstAt(x, y, 46, ['#ffb347', '#ff7a45', '#ffe6a8', '#ffffff'], 330);
    this.popups.push({
      x: x,
      y: y - 46,
      text: '¡BOOM!',
      life: 1.1,
      max: 1.1
    });
    this.sfx.explosion();
    this.shake = Math.max(this.shake, 18);

    this.resolveShot();
  }

  /**
   * Fuerza radial de la explosión:
   *   F = impulso0 · m · (1 − d/R)² / max(d, 10)
   * y daño con la misma caída cuadrática. Se aplica a todos los cuerpos
   * dinámicos (no sensores) dentro de R.
   */
  applyBlast(world, x, y, cfg, exclude, opts = {}) {
    const bodies = (world && world.bodies) ? world.bodies : [];
    const R = cfg.blastRadius;

    for (const body of bodies.slice()) {
      if (!body || body === exclude || body.isStatic || body.isSensor) continue;

      const dx = body.position.x - x;
      const dy = body.position.y - y;
      const d = Math.hypot(dx, dy);
      if (d > R) continue;

      const falloff = Math.pow(1 - d / R, 2);
      const nx = d > 0.001 ? dx / d : 0;
      const ny = d > 0.001 ? dy / d : -1;
      const force = cfg.blastImpulse * body.mass * falloff / Math.max(d, 10);

      Matter.Body.applyForce(body, body.position, {
        x: nx * force,
        y: ny * force
      });

      if (opts.damage !== false) {
        this.applyBlastDamage(body, cfg.blastDamage * falloff);
      }
    }
  }

  applyBlastDamage(body, amount) {
    const g = body && body.game;
    if (!g || !g.hp || g.dead || g.removed || body.isStatic || body.isSensor) return;
    if (g.kind === 'switch') return;

    const dmg = amount * (g.damageMult || 1);
    if (dmg <= 0) return;

    g.hp -= dmg;
    g.hurt = 0.18;
    if (g.hp <= 0) {
      g.hp = 0;
      g.dead = true;
      this.doomed.push(body);
    }
  }

  updateWaves(dt) {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.life -= dt;
      const t = 1 - clamp(w.life / w.max, 0, 1);
      w.r = 12 + (w.radius - 12) * t;
      if (w.life <= 0) this.waves.splice(i, 1);
    }
  }

  drawWaves() {
    noFill();
    for (const wave of this.waves) {
      const alpha = 190 * clamp(wave.life / wave.max, 0, 1);
      stroke(255, 190, 105, alpha);
      strokeWeight(4);
      circle(wave.x, wave.y, wave.r * 2);
      stroke(255, 240, 190, alpha * 0.65);
      strokeWeight(1.5);
      circle(wave.x, wave.y, Math.max(0, wave.r * 1.65));
    }
  }

  /* --------------------- pruebas de la fase 4.12 -------------------- */

  /** Test de conservación del momento al dividir (±0,1 %). */
  testSplitMomentum() {
    const vx = 16;
    const vy = -9;
    const r = CONFIG.BIRD_RADIUS;
    const mass = MATERIALS.bird.density * Math.PI * r * r;
    const parts = splitProjectileVelocities(vx, vy, AMMO_TYPES.split);
    const childMass = mass / parts.length;

    let px = 0;
    let py = 0;
    for (const v of parts) {
      px += childMass * v.vx;
      py += childMass * v.vy;
    }
    const before = { x: mass * vx, y: mass * vy };
    const after = { x: px, y: py };
    const norm = Math.hypot(before.x, before.y) || 1;
    const errorPercent = Math.hypot(px - before.x, py - before.y) / norm * 100;

    return {
      ok: errorPercent < 0.1,
      errorPercent: errorPercent,
      before: before,
      after: after,
      velocities: parts
    };
  }

  /** Comprueba que la fuerza de la explosión decrece claramente con la distancia. */
  testExplosionFalloff() {
    const engine = Matter.Engine.create({
      positionIterations: 10,
      velocityIterations: 8
    });
    engine.gravity.y = CONFIG.GRAVITY;
    const world = engine.world;

    const makeBox = (x, y) => {
      const body = Matter.Bodies.rectangle(x, y, 40, 40, {
        density: MATERIALS.wood.density,
        friction: MATERIALS.wood.friction,
        restitution: MATERIALS.wood.restitution
      });
      body.game = {
        kind: 'block',
        mat: 'wood',
        w: 40,
        h: 40,
        hp: MATERIALS.wood.hp,
        maxHp: MATERIALS.wood.hp,
        damageMult: MATERIALS.wood.damageMult,
        dead: false,
        removed: false
      };
      Matter.Composite.add(world, body);
      return body;
    };

    const bx = 700;
    const by = 300;
    const near = makeBox(bx, by + 40);
    const far = makeBox(bx, by + 120);
    this.applyBlast(world, bx, by, AMMO_TYPES.explosive, null, { damage: false });
    const nearForce = Math.hypot(near.force.x, near.force.y);
    const farForce = Math.hypot(far.force.x, far.force.y);

    return {
      ok: nearForce > farForce * 10,
      nearForce: nearForce,
      farForce: farForce,
      ratio: farForce > 0 ? nearForce / farForce : Infinity
    };
  }

  /** Comprueba que el empuje del cohete aumenta la velocidad del cuerpo. */
  testRocketThrust() {
    const engine = Matter.Engine.create();
    engine.gravity.y = 0;
    const rocket = Matter.Bodies.circle(300, 300, CONFIG.BIRD_RADIUS, {
      density: MATERIALS.bird.density,
      frictionAir: 0
    });
    rocket.game = { type: 'rocket', thrustLeft: 1, dir: { x: 1, y: 0 } };
    Matter.Body.setVelocity(rocket, { x: 8, y: 0 });
    Matter.Composite.add(engine.world, rocket);

    const previousBirds = this.birds;
    const previousParticles = this.particles;
    this.birds = [rocket];
    this.particles = [];
    try {
      const speedBefore = Matter.Vector.magnitude(rocket.velocity);
      this.applyAmmoForces();
      Matter.Engine.update(engine, CONFIG.STEP_MS);
      const speedAfter = Matter.Vector.magnitude(rocket.velocity);
      return {
        ok: speedAfter > speedBefore && rocket.game.thrustLeft === 0,
        speedBefore: speedBefore,
        speedAfter: speedAfter,
        thrustLeft: rocket.game.thrustLeft
      };
    } finally {
      this.birds = previousBirds;
      this.particles = previousParticles;
    }
  }

  /** Comprueba que el rebote devuelve más velocidad que un proyectil normal. */
  testBounceProjectile() {
    const bounceVelocity = (typeId) => {
      const engine = Matter.Engine.create({
        positionIterations: 10,
        velocityIterations: 8
      });
      engine.gravity.y = 0;
      const ground = Matter.Bodies.rectangle(
        this.W / 2, CONFIG.GROUND_Y + 160, 2600, 320,
        { isStatic: true, friction: 0.95, restitution: 0.02 }
      );
      const spec = this.ammoBodySpec(typeId);
      const projectile = Matter.Bodies.circle(300, CONFIG.GROUND_Y - 15, spec.radius, {
        density: spec.density,
        friction: spec.friction,
        frictionAir: 0,
        restitution: spec.restitution
      });
      Matter.Body.setVelocity(projectile, { x: 0, y: 18 });
      Matter.Composite.add(engine.world, [ground, projectile]);
      Matter.Engine.update(engine, CONFIG.STEP_MS);
      return projectile.velocity.y;
    };

    const normalVy = bounceVelocity('normal');
    const bounceVy = bounceVelocity('bounce');
    return {
      ok: normalVy < 0 && bounceVy < normalVy,
      normalVy: normalVy,
      bounceVy: bounceVy
    };
  }

  /**
   * Simulación headless de un disparo con la misma velocidad de goma.
   * Sirve para comparar alcance y empuje entre tipos.
   */
  simulateAmmoShot(typeId, opts = {}) {
    const type = AMMO_TYPES[typeId] || AMMO_TYPES.normal;
    const spec = this.ammoBodySpec(typeId);
    const engine = Matter.Engine.create({
      positionIterations: 10,
      velocityIterations: 8
    });
    engine.gravity.y = CONFIG.GRAVITY;
    const world = engine.world;

    const ground = Matter.Bodies.rectangle(
      this.W / 2, CONFIG.GROUND_Y + 160, 2600, 320,
      { isStatic: true, friction: 0.95, restitution: 0.02, label: 'ground' }
    );
    Matter.Composite.add(world, ground);

    const angle = Number.isFinite(opts.angle) ? opts.angle : 0.42;
    const power = Number.isFinite(opts.power) ? opts.power : 1;
    const speed = CONFIG.MAX_SPEED * (type.launchScale || 1) * power;
    const bird = Matter.Bodies.circle(CONFIG.FORK.x, CONFIG.FORK.y, spec.radius, {
      density: spec.density,
      friction: spec.friction,
      frictionAir: spec.frictionAir,
      restitution: spec.restitution,
      label: 'bird'
    });
    Matter.Body.setVelocity(bird, {
      x: Math.cos(angle) * speed,
      y: -Math.sin(angle) * speed
    });
    Matter.Composite.add(world, bird);

    let box = null;
    let boxStartX = 0;
    if (Number.isFinite(opts.boxX)) {
      box = Matter.Bodies.rectangle(
        opts.boxX, CONFIG.GROUND_Y - 80, 50, 160,
        {
          density: MATERIALS.wood.density,
          friction: MATERIALS.wood.friction,
          restitution: MATERIALS.wood.restitution,
          frictionAir: 0.006
        }
      );
      Matter.Composite.add(world, box);
      boxStartX = box.position.x;
    }

    let range = null;
    let maxX = bird.position.x;
    for (let i = 0; i < 260; i++) {
      Matter.Engine.update(engine, CONFIG.STEP_MS);
      maxX = Math.max(maxX, bird.position.x);
      if (range === null && bird.position.y >= CONFIG.GROUND_Y - spec.radius) {
        range = bird.position.x;
      }
    }

    return {
      type: typeId,
      range: range === null ? maxX : range,
      maxX: maxX,
      boxPush: box ? box.position.x - boxStartX : 0,
      mass: bird.mass,
      speed: speed
    };
  }

  /** Test: el pesado llega más corto y empuja más una caja de madera. */
  testHeavyVsNormal() {
    const normalRange = this.simulateAmmoShot('normal', { angle: 0.42 });
    const heavyRange = this.simulateAmmoShot('heavy', { angle: 0.42 });
    const normalPush = this.simulateAmmoShot('normal', { angle: 0.14, boxX: 500 });
    const heavyPush = this.simulateAmmoShot('heavy', { angle: 0.14, boxX: 500 });

    return {
      ok: heavyRange.range < normalRange.range &&
        heavyPush.boxPush > normalPush.boxPush,
      range: { normal: normalRange.range, heavy: heavyRange.range },
      boxPush: { normal: normalPush.boxPush, heavy: heavyPush.boxPush },
      masses: { normal: normalRange.mass, heavy: heavyRange.mass },
      speeds: { normal: normalRange.speed, heavy: heavyRange.speed }
    };
  }

  runAmmoTests() {
    const result = {
      split: this.testSplitMomentum(),
      explosion: this.testExplosionFalloff(),
      rocket: this.testRocketThrust(),
      bounce: this.testBounceProjectile(),
      heavy: this.testHeavyVsNormal()
    };
    result.ok = result.split.ok && result.explosion.ok &&
      result.rocket.ok && result.bounce.ok && result.heavy.ok;
    console.log('[ammo tests]', result);
    return result;
  }

  isGoalComplete() {
    if (this.goal.type === 'boss') {
      return !!(this.boss && this.boss.hp <= 0);
    }
    if (this.goal.type === 'switch') {
      if (Array.isArray(this.goal.groups) && this.goal.groups.length) {
        return this.goal.groups.every((group) => {
          if (Array.isArray(group.all)) {
            return group.all.every((id) =>
              this.switches.some((s) => s.game.id === id && s.game.activated)
            );
          }
          if (Array.isArray(group.any)) {
            return group.any.some((id) =>
              this.switches.some((s) => s.game.id === id && s.game.activated)
            );
          }
          return false;
        });
      }
      return this.switchesTotal > 0 && this.switchesActivated >= this.switchesTotal;
    }
    return this.totalTargets > 0 && this.targets.length === 0;
  }

  checkWin() {
    if (this.phase === 'won' || this.phase === 'lost') return;
    if (this.isGoalComplete()) this.win();
  }

  /**
   * Estrellas del nivel según los tiros lanzados.
   * 5 si se completa con el par o menos; después baja de una en una.
   */
  computeStars() {
    const par = Math.max(1, this.levelPar || 1);
    const over = Math.max(0, this.shotsUsed - par);
    return clamp(5 - over, 1, 5);
  }

  win() {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.phase = 'won';
    this.dragging = false;
    this.runActive = false;

    this.stars = this.computeStars();
    if (this.mode === 'hardcore' && this.stars < CONFIG.HARDCORE_MIN_STARS) {
      this.hardcoreFailure = 'stars';
      this.phase = 'lost';
      this.runActive = false;
      this.finishHardcoreRun();
      this.sfx.lose();
      return;
    }
    this.bonus = this.shotsLeft * CONFIG.SCORE_SHOT_BONUS;
    this.score += this.bonus;

    // Los modos nuevos premian expresamente la precisión. Los corazones
    // ya suman sus 150 puntos en el momento de recogerlos.
    if (this.mode !== 'classic' && this.mode !== 'infinite') {
      this.score += this.stars * CONFIG.SCORE_STAR;
    }

    const result = this.progress.recordLevel(this.mode, this.levelId, {
      score: this.score,
      stars: this.stars,
      shotsUsed: this.shotsUsed
    });

    this.best = result.best;
    this.bestStars = result.stars;
    this.newBest = result.newBest;
    this.newStars = result.newStars;

    // En Aventura se irá desbloqueando el siguiente nivel en la fase 3.
    if (this.mode === 'adventure' && Number.isFinite(this.levelWorld)) {
      this.progress.unlockNext(this.levelWorld, this.levelNumber);
    }

    if (this.mode === 'hardcore' && this.hardcoreRun) {
      const bossBonus = this.goal.type === 'boss' ? CONFIG.HARDCORE_BOSS_BONUS : 0;
      this.hardcoreRun.levels++;
      this.hardcoreRun.score += this.score + CONFIG.HARDCORE_LEVEL_BONUS + bossBonus;
      this.hardcoreRun.stars += this.stars;
      if (bossBonus) this.hardcoreRun.bosses++;
      if (this.hardcoreRun.levels >= 60) {
        this.hardcoreRun.world = 5;
        this.hardcoreRun.level = 12;
        this.finishHardcoreRun();
      } else {
        const next = this.hardcoreRun.levels;
        this.hardcoreRun.world = Math.floor(next / 12) + 1;
        this.hardcoreRun.level = (next % 12) + 1;
        this.progress.saveHardcoreCheckpoint(this.hardcoreRun);
      }
    } else if (this.mode === 'infinite' && this.infiniteRun) {
      const gamePoints = this.score - this.bonus;
      this.infiniteRun.score += 100 + this.stars * 50 + this.shotsLeft * 25 + gamePoints;
      this.infiniteRun.stars += this.stars;
      this.infiniteRun.hearts += this.heartsCollected;
      this.infiniteRun.reserve = Math.min(CONFIG.INFINITE_MAX_RESERVE, this.shotsLeft);
      this.infiniteRun.levelScore = this.score;
      this.infiniteRun.levelStars = this.stars;
      this.infiniteRun.depth++;
      this.progress.saveInfiniteRun(this.infiniteRun);
    }

    this.sfx.win();
    this.confetti();
  }

  lose() {
    if (this.phase === 'won' || this.phase === 'lost') return;
    if (this.isGoalComplete()) { this.win(); return; }
    if (this.mode === 'adventure') {
      this.adventureLives = Math.max(0, this.adventureLives - 1);
      this.adventureWorld = this.levelWorld;
    }
    this.phase = 'lost';
    this.dragging = false;
    this.runActive = false;
    if (this.mode === 'hardcore') this.finishHardcoreRun();
    if (this.mode === 'infinite' && this.infiniteRun) {
      this.infiniteRun.score += this.score;
      this.finishInfiniteRun();
    }
    this.sfx.lose();
  }

  nextLevel() {
    if (this.mode === 'hardcore') {
      if (!this.hardcoreRun || this.hardcoreRun.levels >= 60) {
        this.screens.openHardcore();
        return;
      }
      this.startHardcoreLevel(this.hardcoreRun.world, this.hardcoreRun.level);
      return;
    }

    if (this.mode === 'infinite') {
      if (!this.infiniteRun) {
        this.screens.openInfinite();
        return;
      }
      if (this.infiniteNext) {
        this.loadInfiniteLevel(this.infiniteNext);
      } else {
        this.screens.setScreen('infinite-loading');
        this.screens.notify('El siguiente nivel se está validando…', 8);
        this.prepareInfiniteNext();
        let waits = 0;
        const waitForNext = () => {
          if (!this.infiniteRun || this.screen !== 'infinite-loading') return;
          if (this.infiniteNext) {
            this.loadInfiniteLevel(this.infiniteNext);
            return;
          }
          if (this.infiniteNextError || ++waits > 1200) {
            const reason = this.infiniteNextError
              ? `No se pudo preparar el siguiente nivel: ${this.infiniteNextError}`
              : 'La validación tardó demasiado. Puedes continuar desde el ranking.';
            this.screens.openInfinite();
            this.screens.notify(reason, 8);
            return;
          }
          setTimeout(waitForNext, 50);
        };
        setTimeout(waitForNext, 50);
      }
      return;
    }

    if (this.mode === 'classic') {
      this.runActive = true;
      this.loadClassic((this.levelIndex + 1) % LEVELS.length);
      return;
    }

    if (this.mode === 'adventure') {
      const nextIndex = this.levelNumber + 1;

      if (nextIndex <= 12) {
        const next = getCampaignLevel(this.levelWorld, nextIndex);
        if (next && (next.ready || this.screens.unlockAll)) {
          this.startCampaignLevel(
            next.ready ? next : Object.assign({}, next, { ready: true }),
            { preserveLives: true }
          );
          return;
        }

        this.screens.openWorld(this.levelWorld);
        this.screens.notify('Nivel en preparación. La aventura continúa próximamente.');
        return;
      }

      if (this.levelWorld < 5) {
        const nextWorld = this.levelWorld + 1;
        const next = getCampaignLevel(nextWorld, 1);
        if (next && (next.ready || this.screens.unlockAll)) {
          this.startCampaignLevel(
            next.ready ? next : Object.assign({}, next, { ready: true }),
            { preserveLives: true }
          );
          return;
        }

        // El jefe del mundo ya está superado: se abre el siguiente mundo
        // en modo vista previa, aunque sus niveles aún no estén listos.
        this.screens.openWorld(nextWorld);
        this.screens.notify(`Mundo ${nextWorld} desbloqueado. Niveles en preparación.`);
        return;
      }

      this.screens.openMenu();
      return;
    }

    this.restartLevel();
  }

  addScore(points, x, y) {
    this.score += points;
    if (x !== undefined) this.popups.push({ x, y, text: `+${points}`, life: 1.0, max: 1.0 });
  }

  /* ------------------------ partículas ----------------------------- */

  burstAt(x, y, count, colors, speed = 220) {
    const rng = makeRng(hash32(
      this.simStep,
      this.particleSeedIndex++ ^ Math.floor(x * 31 + y * 17)
    ));
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const s = speed * (0.35 + rng() * 0.9);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 0.55 + rng() * 0.5,
        max: 1.05,
        size: 4 + rng() * 7,
        color: colors[Math.floor(rng() * colors.length)],
        rot: rng() * Math.PI,
        vrot: (rng() - 0.5) * 12,
        square: rng() < 0.6
      });
    }
  }

  burstBody(body, colors, count) {
    const g = body.game;
    const spread = g.kind === 'target'
      ? (g.r || 17)
      : Math.min(g.w, g.h) * 0.5 + 8;
    this.burstAt(body.position.x, body.position.y, count, colors, 160 + spread * 4);
  }

  confetti() {
    const colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#ffffff'];
    const rng = makeRng(hash32(this.simStep, this.particleSeedIndex++));
    for (let i = 0; i < 90; i++) {
      this.particles.push({
        x: rng() * this.W,
        y: -20 - rng() * 160,
        vx: (rng() - 0.5) * 90,
        vy: 90 + rng() * 130,
        life: 2.4 + rng() * 1.2,
        max: 3.6,
        size: 5 + rng() * 7,
        color: colors[Math.floor(rng() * colors.length)],
        rot: rng() * Math.PI,
        vrot: (rng() - 0.5) * 10,
        square: true
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }

      if (p.smoke) {
        // humo del cohete: sube, se expande y no cae
        p.vx *= 0.96;
        p.vy = p.vy * 0.96 - 18 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += (p.grow || 22) * dt;
        continue;
      }

      if (p.rise) {
        // burbujas: suben y estallan al llegar a la superficie
        p.vy -= 260 * dt;
        p.vx *= 0.99;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const surface = this.fields && this.fields.water
          ? this.fields.water.y
          : -Infinity;
        if (p.y < surface - 1) p.life = 0;
        continue;
      }

      p.vy += 950 * dt;
      p.vx *= 0.995;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;

      if (p.y > CONFIG.GROUND_Y - 2 && p.vy > 0) {
        p.y = CONFIG.GROUND_Y - 2;
        p.vy *= -0.35;
        p.vx *= 0.7;
        p.vrot *= 0.7;
      }
    }
  }

  updatePopups(dt) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.y -= 42 * dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  updateClouds(dt) {
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > this.W + 220) c.x = -220;
    }
  }

  /* --------------------------- render ------------------------------ */

  buildSky() {
    if (this.sky) this.sky.remove();
    const g = createGraphics(this.W, this.H);
    g.noStroke();
    const palette = arguments[0] && arguments[0].palette;
    const top = palette ? color(palette.skyTop) : color(108, 187, 230);
    const bottom = palette ? color(palette.skyBottom) : color(224, 244, 255);
    for (let y = 0; y < this.H; y++) {
      g.fill(lerpColor(top, bottom, y / this.H));
      g.rect(0, y, this.W, 1);
    }
    this.sky = g;
  }

  themeHash(value) {
    const n = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  drawThemeLayers() {
    const id = this.theme.id;
    const far = Math.sin(this.time * 0.035) * 5;
    const middle = Math.sin(this.time * 0.06) * 10;
    const near = Math.sin(this.time * 0.09) * 17;

    if (id === 'meadow') {
      this.drawSun();
      this.drawClouds();
      push(); translate(far, 0); this.drawHills(); pop();
      noStroke();
      fill(105, 145, 83, 105);
      ellipse(190 + middle, 690, 520, 170);
      ellipse(810 - middle, 700, 650, 180);
      fill(83, 128, 71, 145);
      ellipse(520 + near, 715, 720, 160);
    } else if (id === 'canyon') {
      noStroke();
      fill(113, 64, 57, 105);
      beginShape();
      vertex(0, 500); vertex(150 + far, 390); vertex(310 + far, 410);
      vertex(460 + far, 330); vertex(620 + far, 410); vertex(790 + far, 365);
      vertex(960 + far, 420); vertex(1120 + far, 345); vertex(1280, 400);
      vertex(1280, 650); vertex(0, 650); endShape(CLOSE);
      fill(178, 97, 62, 175);
      beginShape();
      vertex(-40, 570); vertex(160 + middle, 460); vertex(300 + middle, 470);
      vertex(430 + middle, 540); vertex(610 + middle, 455); vertex(760 + middle, 470);
      vertex(930 + middle, 550); vertex(1110 + middle, 455); vertex(1330, 510);
      vertex(1330, 650); vertex(-40, 650); endShape(CLOSE);
      fill(211, 143, 82, 110);
      ellipse(300 + near, 650, 770, 180);
      ellipse(1000 - near, 655, 780, 170);
    } else if (id === 'reef') {
      noStroke();
      fill(31, 105, 130, 105);
      ellipse(170 + far, 575, 500, 190);
      ellipse(900 + far, 565, 620, 180);
      fill(40, 138, 151, 92);
      beginShape();
      vertex(0, 525); vertex(170 + middle, 490); vertex(360 + middle, 520);
      vertex(580 + middle, 485); vertex(810 + middle, 520); vertex(1050 + middle, 475);
      vertex(1280, 520); vertex(1280, 650); vertex(0, 650); endShape(CLOSE);
      fill(60, 123, 106, 165);
      ellipse(300 + near, 666, 620, 120);
      ellipse(1010 - near, 675, 760, 130);
      stroke(202, 243, 224, 75);
      strokeWeight(2);
      for (let row = 0; row < 3; row++) {
        beginShape();
        for (let x = 0; x <= this.W; x += 48) {
          vertex(x, 540 + row * 34 + Math.sin(x * 0.012 + this.time * 0.18 + row) * 4);
        }
        endShape();
      }
      stroke(244, 255, 248, 150);
      strokeWeight(2);
      for (let i = 0; i < 4; i++) {
        const gx = (130 + i * 310 + far * (i % 2 ? 1 : -1) + this.W) % this.W;
        const gy = 155 + i * 24 + Math.sin(this.time * 0.25 + i) * 4;
        line(gx - 7, gy, gx, gy - 3);
        line(gx, gy - 3, gx + 7, gy);
      }
    } else if (id === 'factory') {
      noStroke();
      fill(40, 47, 52, 180);
      rect(0, 390, 210, 260);
      rect(248 + far, 330, 260, 320);
      rect(540 + far, 420, 240, 230);
      rect(820 + far, 350, 260, 300);
      rect(1100 + far, 390, 220, 260);
      fill(164, 100, 61, 155);
      rect(80, 310, 48, 120);
      rect(360 + far, 250, 40, 105);
      rect(930 + far, 275, 44, 95);
      push();
      translate(650 + middle, 390);
      rotate(this.time * 0.08);
      noFill(); stroke(196, 135, 91, 100); strokeWeight(7);
      circle(0, 0, 170); circle(0, 0, 90);
      for (let i = 0; i < 8; i++) {
        const a = i * TWO_PI / 8;
        line(Math.cos(a) * 58, Math.sin(a) * 58, Math.cos(a) * 84, Math.sin(a) * 84);
      }
      pop();
      noStroke(); fill(52, 54, 55, 190);
      rect(0, 600, this.W, 70);
      fill(184, 105, 62, 125);
      rect(0, 600 + near * 0.12, this.W, 8);
    } else {
      noStroke();
      fill(82, 51, 122, 32);
      ellipse(420 + far, 300, 720, 380);
      fill(157, 80, 176, 24);
      ellipse(820 - middle, 440, 600, 300);
      for (let i = 0; i < 42; i++) {
        const x = this.themeHash(i * 3 + 1) * this.W;
        const y = this.themeHash(i * 7 + 4) * 500;
        const twinkle = 80 + 100 * (0.5 + 0.5 * Math.sin(this.time * 1.2 + i));
        fill(225, 214, 255, twinkle);
        circle(x, y, 1.2 + this.themeHash(i + 8) * 2.2);
      }
      push();
      translate(1010 + near * 0.2, 330 + Math.sin(this.time * 0.12) * 5);
      noStroke(); fill(179, 151, 205, 220); circle(0, 0, 210);
      fill(73, 60, 105, 155); circle(-28, -22, 190);
      fill(225, 196, 158, 90); ellipse(24, 46, 110, 36);
      pop();
      noStroke(); fill(20, 18, 38, 120);
      rect(0, 600 + near * 0.08, this.W, 90);
    }
  }

  drawThemeParticles() {
    const profile = this.theme.particles;
    const count = profile.count || 12;
    const t = this.time;
    push();
    noFill();
    for (let i = 0; i < count; i++) {
      const seed = this.themeHash(i * 19 + 5);
      const speed = profile.speed || 1;
      let x = (seed * this.W + t * speed * 20) % this.W;
      let y = 80 + this.themeHash(i * 7 + 2) * (CONFIG.GROUND_Y - 130);
      if (profile.kind === 'bubbles') {
        y = CONFIG.GROUND_Y - ((this.themeHash(i * 5 + 1) * 250 + t * speed * 18) % 280);
        stroke(203, 255, 246, 100);
        strokeWeight(1.4);
        circle(x, y, 4 + (i % 4) * 2);
        line(x - 1, y - 2, x + 1, y - 3);
      } else if (profile.kind === 'sand') {
        y = 180 + this.themeHash(i * 13 + 2) * 390;
        if (i % 6 === 0) {
          noFill();
          stroke(255, 214, 157, 90);
          strokeWeight(1.4);
          const angle = t * 0.8 + i;
          arc(x, y, 12 + (i % 4) * 3, 8 + (i % 3) * 2, angle, angle + PI * 1.45);
        } else {
          stroke(255, 214, 157, 75);
          strokeWeight(1.4);
          line(x, y, x + 6 + (i % 5), y - 2);
          noStroke(); fill(profile.color); circle(x, y, 2);
        }
      } else if (profile.kind === 'steam') {
        const puff = (t * 0.35 + i * 0.19) % 1;
        if (Math.sin(t * 0.6 + i * 1.4) < -0.35) continue;
        x = 100 + this.themeHash(i * 11 + 3) * 1080;
        y = CONFIG.GROUND_Y - 30 - puff * 220;
        noStroke(); fill(220, 223, 218, 38 * (1 - puff));
        circle(x, y, 8 + puff * 20);
      } else if (profile.kind === 'stars') {
        y = 60 + this.themeHash(i * 13 + 4) * 470;
        const twinkle = 100 + 150 * (0.5 + 0.5 * Math.sin(t * 1.5 + i));
        noStroke(); fill(245, 236, 255, twinkle);
        circle(x, y, 1.5 + (i % 4) * 0.6);
      } else {
        y = 120 + this.themeHash(i * 13 + 4) * 470 + Math.sin(t * 1.5 + i) * 5;
        noStroke(); fill(profile.color);
        if (i % 5 === 0) {
          ellipse(x, y, 8, 3);
          ellipse(x - 4, y - 2, 6, 4);
          ellipse(x + 4, y - 2, 6, 4);
        } else circle(x, y, 2 + (i % 3));
      }
    }
    pop();
  }

  drawThemeTransition() {
    if (this.themeTransition <= 0) return;
    const alpha = 235 * clamp(this.themeTransition / 0.3, 0, 1);
    noStroke();
    fill(8, 10, 18, alpha);
    rect(0, 0, this.W, this.H);
  }

  render() {
    image(this.sky, 0, 0);

    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;

    push();
    translate(sx, sy);

    if (this.themeActive) this.drawThemeLayers();
    else {
      this.drawSun();
      this.drawClouds();
      this.drawHills();
    }
    this.drawGround();
    if (this.themeActive) this.drawThemeParticles();

    if (this.screen === 'play') {
      if (Fields.has(this.fields)) Fields.drawBack(this.fields);
      this.drawFulcrums();
      this.drawRopes();
      this.drawSlingshotFrame();
      this.drawBands(true);
      this.drawWorldObjects();
      this.drawSwitches();
      if (Fields.has(this.fields)) Fields.draw(this.fields);
      this.drawWaves();
      this.drawProjectile();
      this.drawBands(false);
      this.drawDragHint();
      this.drawAimAssist();
      this.drawParticles();
      this.drawPopups();
      if (this.showPhysics) this.drawPhysicsOverlay();
    } else {
      this.drawSlingshotFrame();
      this.drawParticles();
    }

    pop();

    if (this.screen === 'play') {
      this.drawHud();
      this.drawBanner();
      this.drawOverlay();
    } else {
      this.screens.render();
    }
    this.drawThemeTransition();
  }

  drawSun() {
    const x = 1128, y = 118;
    noStroke();
    for (let i = 5; i >= 1; i--) {
      fill(255, 243, 190, 16);
      circle(x, y, 90 + i * 34);
    }
    fill(255, 246, 205, 235);
    circle(x, y, 96);
    fill(255, 252, 232, 200);
    circle(x - 8, y - 8, 66);
  }

  drawClouds() {
    noStroke();
    for (const c of this.clouds) {
      fill(255, 255, 255, c.a);
      const s = c.s;
      ellipse(c.x, c.y, 150 * s, 54 * s);
      ellipse(c.x - 44 * s, c.y + 8 * s, 96 * s, 42 * s);
      ellipse(c.x + 46 * s, c.y + 10 * s, 108 * s, 46 * s);
      ellipse(c.x + 8 * s, c.y - 18 * s, 92 * s, 52 * s);
    }
  }

  drawHills() {
    noStroke();
    fill(168, 214, 186);
    ellipse(210, 690, 640, 330);
    ellipse(620, 706, 760, 400);
    ellipse(1080, 688, 700, 350);

    fill(140, 195, 152);
    ellipse(60, 712, 520, 290);
    ellipse(880, 724, 820, 360);
  }

  drawGround() {
    const palette = this.themeActive ? this.theme.palette : null;
    noStroke();
    fill(palette ? palette.ground : '#6d4a30');
    rect(0, CONFIG.GROUND_Y, this.W, this.H - CONFIG.GROUND_Y);

    fill(palette ? palette.groundTop : '#7fb257');
    rect(0, CONFIG.GROUND_Y, this.W, 18);
    fill(palette ? color(palette.groundTop) : '#6e9d49');
    rect(0, CONFIG.GROUND_Y + 18, this.W, 8);

    if (!palette || this.theme.groundStyle === 'grass') {
      stroke(palette ? '#526e42' : '#5b8738');
      strokeWeight(3);
      strokeCap(ROUND);
      for (const g of this.grass) {
        line(g.x, CONFIG.GROUND_Y + 2, g.x + 4, CONFIG.GROUND_Y - g.h);
      }
      noStroke();
      fill(0, 0, 0, 26);
      for (const p of this.pebbles) ellipse(p.x, p.y, p.r * 2, p.r * 1.6);
    } else if (this.theme.groundStyle === 'sand') {
      stroke(236, 181, 115, 95);
      strokeWeight(1.5);
      for (let row = 0; row < 5; row++) {
        const y = CONFIG.GROUND_Y + 26 + row * 10;
        for (let x = (row % 2) * 32; x < this.W; x += 64) line(x, y, x + 22, y - 2);
      }
    } else if (this.theme.groundStyle === 'shore') {
      stroke(175, 226, 208, 90);
      strokeWeight(2);
      for (let x = 10; x < this.W; x += 44) arc(x, CONFIG.GROUND_Y + 4, 28, 8, 0, PI);
    } else {
      stroke(palette.accent);
      strokeWeight(1);
      for (let x = 20; x < this.W; x += 72) line(x, CONFIG.GROUND_Y + 30, x, this.H);
      noStroke();
      fill(225, 220, 215, 100);
      for (let x = 28; x < this.W; x += 72) circle(x, CONFIG.GROUND_Y + 30, 4);
    }

    stroke(0, 0, 0, 20);
    strokeWeight(2);
    line(0, CONFIG.GROUND_Y + 26, this.W, CONFIG.GROUND_Y + 26);
  }

  drawSlingshotFrame() {
    const f = CONFIG.FORK;
    strokeCap(ROUND);
    // tronco
    stroke('#59361a');
    strokeWeight(30);
    line(f.x, CONFIG.GROUND_Y + 6, f.x, f.y + 74);
    // horqueta en Y
    stroke('#6d451f');
    strokeWeight(22);
    line(f.x, f.y + 82, f.x - 27, f.y - 4);
    line(f.x, f.y + 82, f.x + 27, f.y - 4);
    // brillo lateral
    stroke(255, 236, 200, 42);
    strokeWeight(5);
    line(f.x - 8, CONFIG.GROUND_Y - 8, f.x - 8, f.y + 78);
  }

  /** Gomas: la trasera se dibuja antes del proyectil y la delantera después. */
  drawBands(back) {
    const f = CONFIG.FORK;
    const tip = back
      ? { x: f.x - 27, y: f.y - 4 }
      : { x: f.x + 27, y: f.y - 4 };

    const holding = this.phase === 'ready' || this.phase === 'aiming' || this.phase === 'reloading';

    if (!holding) {
      // goma suelta colgando entre las horquillas (solo en el pase trasero)
      if (back) {
        noFill();
        stroke('#4a2c19');
        strokeWeight(6);
        strokeCap(ROUND);
        bezier(
          f.x - 27, f.y - 4,
          f.x - 18, f.y + 52,
          f.x + 18, f.y + 52,
          f.x + 27, f.y - 4
        );
      }
      return;
    }

    const stretch = distTo(this.aim.x, this.aim.y, f.x, f.y);
    if (stretch < 8) return; // el proyectil tapa la goma

    const radius = this.ammoRadius(this.currentAmmoType());

    // la goma termina en el borde del proyectil, no en su centro
    const dx = this.aim.x - tip.x;
    const dy = this.aim.y - tip.y;
    const d = Math.hypot(dx, dy) || 1;
    const ex = this.aim.x - (dx / d) * (radius - 2);
    const ey = this.aim.y - (dy / d) * (radius - 2);

    strokeCap(ROUND);
    stroke('#432616');
    strokeWeight(10);
    line(tip.x, tip.y, ex, ey);
    stroke(255, 255, 255, 30);
    strokeWeight(3);
    line(tip.x, tip.y, ex, ey);
  }

  /** Fulcro triangular de las palancas. */
  drawFulcrums() {
    for (const lv of this.levers) {
      const p = lv.constraint ? lv.constraint.pointA : lv.body.position;
      noStroke();
      fill(45, 39, 34, 80);
      triangle(p.x - 22, p.y + 34, p.x + 22, p.y + 34, p.x, p.y + 6);
      fill('#4b4038');
      stroke('#2d2621');
      strokeWeight(2);
      triangle(p.x - 18, p.y + 30, p.x + 18, p.y + 30, p.x, p.y + 4);
      noStroke();
      fill('#8d7c6b');
      circle(p.x, p.y + 3, 7);
    }
  }

  /** Cuerdas de los pesos colgantes. */
  drawRopes() {
    for (const rope of this.ropes) {
      const a = rope.anchor;
      const weight = rope.weight;
      if (!weight || weight.game.removed) {
        this.drawCutRope(a, 26);
        continue;
      }

      const b = weight.position;
      if (rope.cut) {
        this.drawCutRope(a, 28);
        // hilo suelto sobre el peso
        stroke('#5b3d26');
        strokeWeight(4);
        strokeCap(ROUND);
        line(b.x, b.y - weight.circleRadius - 8, b.x, b.y - weight.circleRadius);
        continue;
      }

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const ex = b.x - (dx / d) * (weight.circleRadius - 2);
      const ey = b.y - (dy / d) * (weight.circleRadius - 2);

      const stretch = Math.max(0, d - rope.length);
      const tense = clamp(stretch / 18, 0, 1);

      strokeCap(ROUND);
      stroke(74, 44, 25);
      strokeWeight(7);
      line(a.x, a.y, ex, ey);
      stroke(lerpColor(color('#8a6a45'), color('#c05a48'), tense));
      strokeWeight(3);
      line(a.x, a.y, ex, ey);

      // nudo en el anclaje
      noStroke();
      fill('#4a2c19');
      circle(a.x, a.y, 9);
      fill(255, 255, 255, 55);
      circle(a.x - 1.5, a.y - 1.5, 3);
    }
  }

  drawCutRope(a, len) {
    noFill();
    stroke('#5b3d26');
    strokeWeight(5);
    strokeCap(ROUND);
    bezier(a.x, a.y, a.x - 4, a.y + len * 0.45, a.x + 7, a.y + len * 0.8, a.x + 2, a.y + len);
    stroke(255, 255, 255, 40);
    strokeWeight(1.5);
    bezier(a.x, a.y, a.x - 4, a.y + len * 0.45, a.x + 7, a.y + len * 0.8, a.x + 2, a.y + len);
  }

  /** Reactores: orbes de energía que se activan al recibir un impacto. */
  drawSwitches() {
    for (const s of this.switches) {
      const g = s.game;
      const r = g.r;
      const x = s.position.x;
      const y = s.position.y;
      const on = g.activated;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * (on ? 5.2 : 3.1));
      const glow = on ? 0.55 + 0.45 * pulse : 0.28 + 0.22 * pulse;

      push();
      translate(x, y);

      // halo
      noStroke();
      const base = on
        ? color('#6cf08d')
        : color(this.themeActive ? this.theme.palette.reactor : '#5cc8e8');
      for (let i = 3; i >= 1; i--) {
        const c = color(base);
        c.setAlpha(16 + 20 * glow);
        fill(c);
        circle(0, 0, r * 2 + i * 18);
      }

      // anillo exterior
      noFill();
      stroke(on ? '#8ff09b' : base);
      strokeWeight(3);
      circle(0, 0, r * 2 + 8);

      // cuerpo
      fill(12, 24, 32, 220);
      stroke(on ? '#5ce27a' : base);
      strokeWeight(2.5);
      circle(0, 0, r * 1.55);

      const core = color(base);
      core.setAlpha(on ? 210 : 150);
      fill(on ? color(122, 240, 150, 210) : core);
      noStroke();
      circle(0, 0, r * (on ? 1.05 : 0.8));

      // núcleo
      fill(on ? '#ffffff' : '#d6f7ff');
      circle(0, 0, r * 0.34);

      // marcas orbitando
      stroke(on ? '#b8ffc6' : base);
      strokeWeight(2);
      noFill();
      arc(0, 0, r * 2 + 16, r * 2 + 16, this.time * 1.4, this.time * 1.4 + 1.2);
      arc(0, 0, r * 2 + 16, r * 2 + 16, this.time * 1.4 + PI, this.time * 1.4 + PI + 1.2);

      if (g.requireChain) {
        useText(9, true);
        textAlign(CENTER, CENTER);
        fill(on ? '#b8ffc6' : '#9fd9e8');
        noStroke();
        text('CADENA', 0, r + 18);
      }

      pop();
    }
  }

  drawWorldObjects() {
    for (const b of this.blocks) this.drawBlock(b);
    for (const t of this.targets) this.drawTarget(t);
    for (const h of this.hearts) this.drawHeartPickup(h);
    this.drawBoss();
  }

  drawWeight(b) {
    const g = b.game;
    const r = g.r;

    push();
    translate(b.position.x, b.position.y);
    rotate(b.angle);

    noStroke();
    fill(28, 22, 16, 45);
    ellipse(3, 4, r * 2, r * 1.9);

    fill('#7f8b98');
    stroke('#4e5964');
    strokeWeight(2.4);
    circle(0, 0, r * 2);

    noFill();
    stroke(255, 255, 255, 55);
    strokeWeight(2);
    arc(0, 0, r * 1.6, r * 1.6, -2.4, -0.5);

    noStroke();
    fill('#a9b4bf');
    ellipse(-r * 0.28, -r * 0.3, r * 0.55, r * 0.4);

    // anilla superior
    noFill();
    stroke('#5c6874');
    strokeWeight(4);
    arc(0, -r * 0.92, r * 0.72, r * 0.52, PI, TWO_PI);

    if (g.hurt > 0) {
      noStroke();
      fill(255, 255, 255, clamp(g.hurt * 620, 0, 150));
      circle(0, 0, r * 2);
    }

    pop();
  }

  drawLever(b) {
    const g = b.game;
    const w = g.w, h = g.h;

    push();
    translate(b.position.x, b.position.y);
    rotate(b.angle);
    rectMode(CENTER);

    noStroke();
    fill(28, 22, 16, 40);
    rect(3, 4, w, h, 4);

    fill('#b98a55');
    stroke('#7d4f27');
    strokeWeight(2);
    rect(0, 0, w, h, 4);

    noStroke();
    fill(255, 236, 200, 55);
    rect(-w * 0.42, -h * 0.24, w * 0.84, h * 0.16, 2);

    // refuerzo metálico en el pivote
    fill('#6d7784');
    stroke('#414952');
    strokeWeight(2);
    rect(0, 0, 30, h + 7, 4);
    noStroke();
    fill('#aab4c0');
    circle(-8, 0, 4);
    circle(8, 0, 4);

    if (g.activated) {
      noFill();
      stroke(255, 209, 102, 120);
      strokeWeight(2);
      rect(0, 0, w - 2, h - 2, 4);
    }

    pop();
  }

  drawDomino(b) {
    const g = b.game;
    const w = g.w, h = g.h;

    push();
    translate(b.position.x, b.position.y);
    rotate(b.angle);
    rectMode(CENTER);

    noStroke();
    fill(28, 22, 16, 40);
    rect(3, 4, w, h, 3);

    fill('#efe3c4');
    stroke(g.triggered ? '#d9a93f' : '#b49a66');
    strokeWeight(1.8);
    rect(0, 0, w, h, 3);

    // línea central y pips
    stroke('#b49a66');
    strokeWeight(1.2);
    line(-w * 0.34, 0, w * 0.34, 0);

    noStroke();
    fill('#8a7348');
    const dots = [
      [-w * 0.16, -h * 0.26], [w * 0.16, -h * 0.12],
      [-w * 0.16, h * 0.16], [w * 0.16, h * 0.3],
      [0, h * 0.02]
    ];
    for (const d of dots) circle(d[0], d[1], Math.max(1.6, w * 0.12));

    if (g.triggered) {
      noFill();
      stroke(255, 209, 102, 110);
      strokeWeight(2);
      rect(0, 0, w + 5, h + 5, 4);
    }

    pop();
  }

  drawBlock(b) {
    const g = b.game;
    if (g.kind === 'weight') { this.drawWeight(b); return; }
    if (g.kind === 'lever') { this.drawLever(b); return; }
    if (g.kind === 'domino') { this.drawDomino(b); return; }
    if (g.kind === 'wheel') { this.drawWheel(b); return; }

    const mat = MATERIALS[g.mat] || MATERIALS.wood;
    const ratio = clamp(g.hp / g.maxHp, 0, 1);
    const w = g.w, h = g.h;

    push();
    translate(b.position.x, b.position.y);
    rotate(b.angle);
    rectMode(CENTER);

    // sombra proyectada
    noStroke();
    fill(28, 22, 16, 38);
    rect(3, 4, w, h, 4);

    // cuerpo
    const themedFill = this.themeActive && this.theme.palette.blocks[g.mat]
      ? this.theme.palette.blocks[g.mat]
      : mat.fill;
    fill(themedFill);
    stroke(mat.stroke);
    strokeWeight(2);
    rect(0, 0, w, h, 4);

    // textura
    if (g.mat === 'wood') {
      stroke(mat.grain);
      strokeWeight(1.5);
      if (w >= h) {
        for (let i = -1; i <= 1; i++) {
          line(-w * 0.38, i * h * 0.24, w * 0.38, i * h * 0.24);
        }
      } else {
        for (let i = -1; i <= 1; i++) {
          line(i * w * 0.24, -h * 0.38, i * w * 0.24, h * 0.38);
        }
      }
    } else if (g.mat === 'stone') {
      const rng = makeRng(g.seed);
      noStroke();
      fill(mat.grain);
      for (let i = 0; i < 7; i++) {
        ellipse(
          (rng() - 0.5) * w * 0.78,
          (rng() - 0.5) * h * 0.78,
          3 + rng() * 5, 3 + rng() * 4
        );
      }
    } else if (g.mat === 'steel') {
      // bandas metálicas y remaches (también usado por los espejos)
      noStroke();
      fill(255, 255, 255, 48);
      rect(-w * 0.42, -h * 0.3, w * 0.84, h * 0.18, 1);
      fill(0, 0, 0, 30);
      rect(-w * 0.42, h * 0.12, w * 0.84, h * 0.16, 1);
      fill(220, 235, 245, 150);
      circle(-w * 0.4, 0, 2.5);
      circle(w * 0.4, 0, 2.5);
    } else if (g.mat === 'ice') {
      // hielo: vetas y brillo, con la temperatura del campo térmico
      const rng = makeRng(g.seed + 21);
      noStroke();
      fill(255, 255, 255, 70);
      quad(-w * 0.38, h * 0.4, -w * 0.2, h * 0.4, w * 0.26, -h * 0.4, w * 0.08, -h * 0.4);
      stroke(255, 255, 255, 155);
      strokeWeight(1.4);
      for (let i = 0; i < 4; i++) {
        const x0 = (rng() - 0.5) * w * 0.7;
        const y0 = (rng() - 0.5) * h * 0.7;
        line(x0, y0, x0 + (rng() - 0.5) * w * 0.35, y0 + h * 0.32);
      }
      noFill();
      stroke(255, 255, 255, 120);
      rect(0, 0, w - 6, h - 6, 3);
    } else {
      // vidrio: brillo diagonal
      noStroke();
      fill(255, 255, 255, 60);
      quad(-w * 0.36, h * 0.42, -w * 0.16, h * 0.42, w * 0.3, -h * 0.42, w * 0.06, -h * 0.42);
      stroke(255, 255, 255, 130);
      strokeWeight(1.4);
      noFill();
      rect(0, 0, w - 7, h - 7, 3);
    }

    // grietas según daño
    if (ratio < 0.92) {
      const rng = makeRng(g.seed + 7);
      const cracks = Math.ceil((1 - ratio) * 5);
      stroke(40, 24, 12, 190);
      strokeWeight(1.8);
      for (let i = 0; i < cracks; i++) {
        const cx = (rng() - 0.5) * w * 0.7;
        const cy = (rng() - 0.5) * h * 0.7;
        line(cx, cy, cx + (rng() - 0.5) * w * 0.4, cy + (rng() - 0.5) * h * 0.5);
      }
    }

    // destello al recibir un golpe
    if (g.hurt > 0) {
      noStroke();
      fill(255, 255, 255, clamp(g.hurt * 620, 0, 170));
      rect(0, 0, w, h, 4);
    }

    pop();
  }

  drawWheel(body) {
    const g = body.game;
    const mat = MATERIALS[g.mat] || MATERIALS.wood;
    const r = g.r;
    push();
    translate(body.position.x, body.position.y);
    rotate(body.angle);
    noStroke();
    fill(28, 22, 16, 45);
    circle(3, 4, r * 2);
    fill(this.themeActive && this.theme.palette.blocks[g.mat]
      ? this.theme.palette.blocks[g.mat]
      : mat.fill);
    stroke(mat.stroke);
    strokeWeight(3);
    circle(0, 0, r * 2);
    noFill();
    stroke(255, 255, 255, 90);
    strokeWeight(g.hollow ? 5 : 2);
    circle(0, 0, g.hollow ? r * 1.35 : r * 1.55);
    stroke(mat.stroke);
    strokeWeight(3);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      line(0, 0, Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
    }
    noStroke();
    fill(mat.stroke);
    circle(0, 0, r * 0.36);
    pop();
  }

  drawTarget(t) {
    const g = t.game;
    const r = g.r || 17;
    const hurtRatio = clamp(g.hp / g.maxHp, 0, 1);

    push();
    translate(t.position.x, t.position.y);
    rotate(t.angle);

    // sombra
    noStroke();
    fill(28, 22, 16, 42);
    ellipse(2, 3, r * 2, r * 1.9);

    // orejas
    fill('#6cc24e');
    stroke('#418a2b');
    strokeWeight(2.2);
    triangle(-r * 0.62, -r * 0.7, -r * 0.2, -r * 1.12, -r * 0.1, -r * 0.58);
    triangle(r * 0.62, -r * 0.7, r * 0.2, -r * 1.12, r * 0.1, -r * 0.58);

    // cuerpo
    fill('#6cc24e');
    ellipse(0, 0, r * 2, r * 1.95);

    // hocico
    noStroke();
    fill('#93de72');
    ellipse(0, r * 0.3, r * 1.05, r * 0.8);
    fill('#3f7f2a');
    ellipse(-r * 0.15, r * 0.3, r * 0.13, r * 0.17);
    ellipse(r * 0.15, r * 0.3, r * 0.13, r * 0.17);

    // ojos
    fill('#ffffff');
    ellipse(-r * 0.35, -r * 0.16, r * 0.52, r * 0.58);
    ellipse(r * 0.35, -r * 0.16, r * 0.52, r * 0.58);
    fill('#20242c');
    ellipse(-r * 0.31, -r * 0.14, r * 0.22, r * 0.26);
    ellipse(r * 0.39, -r * 0.14, r * 0.22, r * 0.26);

    // ceño cuando está dañado
    if (hurtRatio < 0.55) {
      stroke('#2f6420');
      strokeWeight(2.4);
      line(-r * 0.56, -r * 0.52, -r * 0.14, -r * 0.36);
      line(r * 0.14, -r * 0.36, r * 0.56, -r * 0.52);
    }

    // destello
    if (g.hurt > 0) {
      noStroke();
      fill(255, 255, 255, clamp(g.hurt * 620, 0, 160));
      ellipse(0, 0, r * 2, r * 1.95);
    }

    pop();
  }

  /** Corazón opcional que flota en el nivel. */
  drawHeartPickup(body) {
    const g = body.game;
    if (!g || g.collected) return;

    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3.4 + g.pulse);
    const s = 1 + 0.07 * pulse;
    const x = body.position.x;
    const y = body.position.y + Math.sin(this.time * 2.2 + g.pulse) * 3;

    push();
    translate(x, y);
    scale(s);

    // halo
    noStroke();
    for (let i = 3; i >= 1; i--) {
      fill(255, 120, 150, 12 + 10 * pulse);
      circle(0, 0, g.r * 2 + i * 20);
    }

    // anillo del sensor
    noFill();
    stroke(255, 160, 180, 110);
    strokeWeight(1.5);
    circle(0, 0, g.r * 2 + 4);

    this.drawHeartIcon(
      0, 0, 22, true,
      this.themeActive ? this.theme.palette.accent : '#ff6f8b'
    );

    // brillo
    noStroke();
    fill(255, 255, 255, 120);
    ellipse(-7, -9, 6, 4);

    pop();
  }

  /** Dibuja un corazón vectorial centrado en (x, y). */
  drawHeartIcon(x, y, size, filled, themeColor) {
    push();
    translate(x, y);

    if (filled) {
      fill(themeColor || '#ff6f8b');
      stroke(themeColor || '#c73d5a');
    } else {
      fill(255, 255, 255, 16);
      stroke(255, 255, 255, 90);
    }
    strokeWeight(2);

    beginShape();
    vertex(0, size * 0.58);
    bezierVertex(-size * 1.05, -size * 0.16, -size * 0.52, -size * 1.02, 0, -size * 0.34);
    bezierVertex(size * 0.52, -size * 1.02, size * 1.05, -size * 0.16, 0, size * 0.58);
    endShape(CLOSE);

    if (filled) {
      noStroke();
      fill(255, 255, 255, 95);
      ellipse(-size * 0.34, -size * 0.32, size * 0.28, size * 0.2);
    }

    pop();
  }

  /** Calavera vectorial del HUD de Hardcore (evita glifos no disponibles). */
  drawSkull(x, y, size, colorValue) {
    push();
    translate(x, y);
    noStroke();
    fill(colorValue);
    ellipse(0, -size * 0.12, size * 0.78, size * 0.7);
    rect(-size * 0.3, size * 0.04, size * 0.6, size * 0.34, size * 0.1);
    fill(10, 18, 26);
    circle(-size * 0.17, -size * 0.14, size * 0.2);
    circle(size * 0.17, -size * 0.14, size * 0.2);
    triangle(0, size * 0.02, -size * 0.07, size * 0.12, size * 0.07, size * 0.12);
    rect(-size * 0.18, size * 0.19, size * 0.36, size * 0.06, 1);
    pop();
  }

  /** Jefe de mundo: orbe guardian con ojo y aura de invulnerabilidad. */
  drawBoss() {
    const boss = this.boss;
    if (!boss || boss.hp <= 0) return;

    const x = boss.body.position.x;
    const y = boss.body.position.y;
    const r = boss.r;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4.1);
    const c = color(boss.color);

    push();
    translate(x, y);

    // aura
    noStroke();
    for (let i = 4; i >= 1; i--) {
      const glow = color(c);
      glow.setAlpha(10 + 12 * pulse);
      fill(glow);
      circle(0, 0, r * 2 + i * 20);
    }

    // anillos
    noFill();
    stroke(red(c), green(c), blue(c), 185);
    strokeWeight(3);
    circle(0, 0, r * 2 + 8);
    stroke(255, 255, 255, 55);
    strokeWeight(1.5);
    circle(0, 0, r * 2 + 20);

    // cuerpo
    fill(28, 20, 28, 245);
    stroke(boss.color);
    strokeWeight(3);
    circle(0, 0, r * 1.7);

    // púas
    noStroke();
    fill(c);
    for (let i = 0; i < 8; i++) {
      const a = this.time * 0.45 + (i * TWO_PI) / 8;
      const bx = cos(a) * r * 0.82;
      const by = sin(a) * r * 0.82;
      push();
      translate(bx, by);
      rotate(a + HALF_PI);
      triangle(-6, 8, 6, 8, 0, -8);
      pop();
    }

    // ojo
    noStroke();
    fill('#fff5e6');
    ellipse(0, 0, r * 1.3, r * 0.88);
    fill('#2a1b22');
    ellipse(0, 0, r * 0.62, r * 0.62);
    fill(boss.color);
    ellipse(0, 0, r * 0.34, r * 0.34);
    fill(255, 255, 255, 210);
    circle(-r * 0.12, -r * 0.12, r * 0.12);

    // destello de impacto
    if (boss.flash > 0) {
      noStroke();
      fill(255, 255, 255, clamp(boss.flash * 700, 0, 170));
      circle(0, 0, r * 2.1);
    }

    // escudo durante la invulnerabilidad
    if (boss.invuln > 0) {
      noFill();
      stroke(255, 225, 160, 190);
      strokeWeight(2.5);
      circle(0, 0, r * 2.35 + Math.sin(this.time * 18) * 4);
    }

    pop();
  }

  drawProjectile() {
    if (this.birds.length) {
      for (const b of this.birds) {
        if (!b || !b.game || b.game.removed) continue;
        const r = b.circleRadius;
        this.drawBird(b.position.x, b.position.y, r, b.angle, b.game.type);
      }

      // estela del proyectil principal
      noStroke();
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        const a = (i / this.trail.length) * 70;
        fill(255, 255, 255, a);
        circle(p.x, p.y, 3 + (i / this.trail.length) * 9);
      }
      return;
    }

    if (this.bird) {
      this.drawBird(
        this.bird.position.x, this.bird.position.y,
        this.bird.circleRadius, this.bird.angle,
        this.bird.game ? this.bird.game.type : 'normal'
      );
      return;
    }

    if (this.phase === 'ready' || this.phase === 'aiming' || this.phase === 'reloading') {
      const type = this.currentAmmoType();
      const v = this.launchVector();
      const angle = Math.hypot(v.x, v.y) > 0.5 ? Math.atan2(v.y, v.x) : 0;
      this.drawBird(this.aim.x, this.aim.y, this.ammoRadius(type), angle, type);
    }
  }

  drawBird(x, y, r, angle, typeId = 'normal') {
    const t = AMMO_TYPES[typeId] || AMMO_TYPES.normal;

    push();
    translate(x, y);
    rotate(angle);

    // llama del cohete (detrás del cuerpo)
    if (typeId === 'rocket') {
      const flick = 1 + 0.16 * Math.sin(this.time * 26);
      noStroke();
      fill(255, 120, 60, 210);
      triangle(-r * 0.7, -r * 0.42, -r * 0.7, r * 0.42, -r * (1.1 + 0.7 * flick), 0);
      fill(255, 216, 120, 230);
      triangle(-r * 0.7, -r * 0.22, -r * 0.7, r * 0.22, -r * (0.95 + 0.4 * flick), 0);
    }

    // sombra
    noStroke();
    fill(30, 24, 18, 35);
    ellipse(2, 3, r * 2, r * 1.9);

    // cuerpo
    fill(t.color || '#e0453c');
    stroke(t.edge || '#a5281f');
    strokeWeight(2.4);
    ellipse(0, 0, r * 2, r * 1.95);

    // vientre
    noStroke();
    fill(typeId === 'heavy' ? '#d7dde3' : '#f7d6b3');
    ellipse(0, r * 0.34, r * 1.08, r * 0.78);

    // penacho
    fill(t.color || '#e0453c');
    triangle(-r * 0.16, -r * 0.92, r * 0.34, -r * 0.86, -r * 0.02, -r * 1.46);

    // ojos
    fill('#ffffff');
    ellipse(-r * 0.34, -r * 0.26, r * 0.6, r * 0.68);
    ellipse(r * 0.26, -r * 0.28, r * 0.54, r * 0.64);
    fill('#20242c');
    ellipse(-r * 0.27, -r * 0.22, r * 0.26, r * 0.3);
    ellipse(r * 0.33, -r * 0.24, r * 0.24, r * 0.28);

    // cejas
    stroke('#20242c');
    strokeWeight(2.6);
    line(-r * 0.58, -r * 0.62, -r * 0.12, -r * 0.5);
    line(r * 0.1, -r * 0.52, r * 0.52, -r * 0.64);

    // pico
    noStroke();
    fill('#f3a02c');
    triangle(r * 0.42, r * 0.02, r * 1.16, r * 0.16, r * 0.42, r * 0.42);

    // marcas propias de cada tipo
    if (typeId === 'heavy') {
      noFill();
      stroke(255, 255, 255, 90);
      strokeWeight(1.6);
      ellipse(0, 0, r * 1.55, r * 1.5);
    } else if (typeId === 'bounce') {
      stroke('#d8f7ff');
      strokeWeight(1.8);
      noFill();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TWO_PI + this.time * 2;
        arc(0, 0, r * 2.3, r * 2.3, a, a + 0.8);
      }
    } else if (typeId === 'explosive') {
      stroke('#7a4211');
      strokeWeight(2.4);
      noFill();
      line(-r * 0.25, -r * 0.9, -r * 0.45, -r * 1.35);
      noStroke();
      fill(255, 214, 120);
      circle(-r * 0.45, -r * 1.4, 3 + 4 * (0.5 + 0.5 * Math.sin(this.time * 30)));
    } else if (typeId === 'split') {
      noStroke();
      fill('#f2e6ff');
      circle(-r * 0.34, 0, r * 0.3);
      circle(0, -r * 0.3, r * 0.3);
      circle(r * 0.34, 0, r * 0.3);
    }

    pop();
  }

  /** Pista animada que solo aparece antes del primer disparo. */
  drawDragHint() {
    if (this.shotCount > 0 || this.phase !== 'ready') return;

    const f = CONFIG.FORK;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3.2);
    const ghost = { x: f.x - 88, y: f.y + 76 };

    push();

    // estela punteada desde la horquilla hasta el punto de arrastre
    stroke(255, 255, 255, 90 + 90 * pulse);
    strokeWeight(3);
    strokeCap(ROUND);
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const t0 = (i - 0.65) / steps;
      const t1 = i / steps;
      line(
        lerp(f.x, ghost.x, t0), lerp(f.y, ghost.y, t0),
        lerp(f.x, ghost.x, t1), lerp(f.y, ghost.y, t1)
      );
    }

    // punta de flecha
    noStroke();
    fill(255, 255, 255, 110 + 90 * pulse);
    push();
    translate(ghost.x, ghost.y);
    rotate(Math.atan2(ghost.y - f.y, ghost.x - f.x));
    triangle(0, 0, -18, -9, -18, 9);
    pop();

    // anillo alrededor del proyectil
    noFill();
    stroke(255, 255, 255, 70 + 80 * pulse);
    strokeWeight(2.5);
    circle(f.x, f.y, 56 + 12 * pulse);

    // etiqueta
    noStroke();
    useText(14, true);
    textAlign(CENTER, CENTER);
    const label = 'ARRASTRA Y SUELTA';
    const tw = textWidth(label) + 30;
    fill(10, 18, 26, 170);
    rect(f.x - 86 - tw / 2, f.y - 110, tw, 34, 10);
    fill(255, 255, 255, 225);
    text(label, f.x - 86, f.y - 92);

    pop();
  }

  drawAimAssist() {
    if (this.phase !== 'aiming' || !this.dragging) return;

    const v = this.launchVector();
    const speed = Math.hypot(v.x, v.y);
    if (speed < 1) return;

    // --- predicción de trayectoria con los MISMOS campos que el vuelo ---
    const prediction = this.predictTrajectory(v, this.currentAmmoType());
    const points = prediction.points;

    noStroke();
    for (let i = 0; i < points.length; i += 4) {
      const p = points[i];
      const a = 190 * (1 - i / 165);
      fill(255, 255, 255, a);
      circle(p.x, p.y, Math.max(2.5, 7.5 - i * 0.035));
    }
    if (prediction.effect) {
      this.drawAmmoEffectMarker(prediction.effect);
    }

    // --- anillo de potencia en torno al proyectil ---------------------
    const power = clamp(speed / CONFIG.MAX_SPEED, 0, 1);
    noFill();
    stroke(255, 255, 255, 70);
    strokeWeight(4);
    circle(this.aim.x, this.aim.y, CONFIG.BIRD_RADIUS * 2 + 16);

    stroke(power > 0.8 ? '#ff7a6b' : power > 0.45 ? '#ffd166' : '#7ddc8a');
    strokeWeight(4);
    arc(
      this.aim.x, this.aim.y,
      CONFIG.BIRD_RADIUS * 2 + 16, CONFIG.BIRD_RADIUS * 2 + 16,
      -HALF_PI, -HALF_PI + TWO_PI * power
    );
  }

  drawAmmoEffectMarker(point) {
    push();
    noFill();
    stroke('#fff3b0');
    strokeWeight(2.5);
    circle(point.x, point.y, 22);
    line(point.x - 6, point.y - 6, point.x + 6, point.y + 6);
    line(point.x + 6, point.y - 6, point.x - 6, point.y + 6);
    pop();
  }

  /**
   * Simula el vuelo de un proyectil virtual con la misma integración y
   * los mismos campos que el motor. Solo clona posición, velocidad, masa,
   * área y frictionAir. La línea termina en el primer choque, al entrar
   * en el agua o tras FIELD_PREDICT_STEPS pasos.
   */
  predictTrajectory(v, typeId = this.currentAmmoType()) {
    const prediction = { points: [], effect: null };
    if (!this.aim) return prediction;

    const state = Fields.create(this.activeFields, { game: this, predict: true });
    const type = AMMO_TYPES[typeId] || AMMO_TYPES.normal;
    const spec = this.ammoBodySpec(typeId);
    const body = Matter.Bodies.circle(this.aim.x, this.aim.y, spec.radius, {
      density: spec.density,
      friction: spec.friction,
      frictionAir: spec.frictionAir,
      restitution: spec.restitution,
      label: 'predict'
    });
    body.game = { kind: 'predict', type: typeId };
    body.ferrous = !!this.birdFerrous;
    Matter.Body.setVelocity(body, v);

    const obstacles = this.predictionBodies();
    const dtSq = CONFIG.STEP_MS * CONFIG.STEP_MS;
    const gravityForce = body.mass * CONFIG.GRAVITY * 0.001;
    const steps = CONFIG.FIELD_PREDICT_STEPS;

    for (let i = 0; i < steps; i++) {
      const step = this.simStep + i;

      if (Fields.has(state)) {
        Fields.apply(state, [body], step, { silent: true });
      }

      if (typeId === 'rocket' && i < type.thrustSteps) {
        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        const dir = speed > 0.05
          ? { x: body.velocity.x / speed, y: body.velocity.y / speed }
          : { x: v.x / (Math.hypot(v.x, v.y) || 1), y: v.y / (Math.hypot(v.x, v.y) || 1) };
        const force = body.mass * type.thrustAccel / dtSq;
        body.force.x += dir.x * force;
        body.force.y += dir.y * force;
      }

      // Integración de un cuerpo libre de Matter con las fuerzas del paso.
      const air = 1 - body.frictionAir;
      body.velocity.x = body.velocity.x * air +
        (body.force.x / body.mass) * dtSq;
      body.velocity.y = body.velocity.y * air +
        ((body.force.y + gravityForce) / body.mass) * dtSq;
      body.force.x = 0;
      body.force.y = 0;
      body.torque = 0;

      const nx = body.position.x + body.velocity.x;
      const ny = body.position.y + body.velocity.y;
      Matter.Body.setPosition(body, { x: nx, y: ny });

      // El agua corta la línea justo al tocar la superficie.
      if (state.water && ny + spec.radius >= state.water.y) break;

      if (nx < -120 || nx > this.W + 60 || ny > this.H + 120 || ny < -500) break;
      if (this.trajectoryHit(body, obstacles)) {
        if (typeId === 'explosive' || typeId === 'split') {
          prediction.effect = { x: nx, y: ny };
        }
        break;
      }

      prediction.points.push({ x: nx, y: ny });
      if (typeId === 'split' && i + 1 >= type.splitDelay) {
        prediction.effect = { x: nx, y: ny };
        break;
      }
    }

    return prediction;
  }

  /** Cuerpos sólidos con los que puede chocar la línea de predicción. */
  predictionBodies() {
    const list = this.blocks.concat(this.targets, this.strayBirds);
    if (this.ground) list.push(this.ground);
    return list;
  }

  /** Verdadero si el proyectil virtual solapa algún cuerpo sólido. */
  trajectoryHit(body, obstacles) {
    const nearby = Matter.Query.region(obstacles, body.bounds);
    for (const other of nearby) {
      if (other === body || other.isSensor) continue;
      if (Matter.Query.collides(body, [other]).length) return true;
    }
    return false;
  }

  drawParticles() {
    noStroke();
    for (const p of this.particles) {
      const a = clamp(p.life / 0.6, 0, 1) * 255;
      const c = color(p.color);
      c.setAlpha(a);

      push();
      translate(p.x, p.y);
      rotate(p.rot);
      fill(c);
      if (p.square) {
        rectMode(CENTER);
        rect(0, 0, p.size, p.size * 0.7);
      } else {
        circle(0, 0, p.size);
      }
      pop();
    }
  }

  drawPopups() {
    if (!this.popups.length) return;
    push();
    textAlign(CENTER, CENTER);
    useText(20, true);
    for (const p of this.popups) {
      const a = clamp(p.life / p.max, 0, 1);
      fill(20, 30, 20, 110 * a);
      text(p.text, p.x + 1, p.y + 2);
      fill(255, 226, 120, 255 * a);
      text(p.text, p.x, p.y);
    }
    pop();
  }

  /* ------------------------ overlay físico ------------------------- */

  drawPhysicsOverlay() {
    push();

    const bodies = this.blocks.concat(this.targets);
    const gPx = 0.001 * CONFIG.GRAVITY * 1000000; // px/s²

    // Vectores de velocidad
    for (const b of bodies) {
      if (b.isStatic) continue;
      const v = b.velocity;
      const speed = Math.hypot(v.x, v.y);
      if (speed < 0.15) continue;

      const k = 5;
      const x = b.position.x;
      const y = b.position.y;
      stroke(120, 220, 255, 135);
      strokeWeight(1.6);
      line(x, y, x + v.x * k, y + v.y * k);
      noStroke();
      fill(120, 220, 255, 170);
      circle(x + v.x * k, y + v.y * k, 3);
    }

    if (this.bird) {
      const v = this.bird.velocity;
      const k = 6;
      const x = this.bird.position.x;
      const y = this.bird.position.y;
      stroke(255, 220, 100, 210);
      strokeWeight(2.2);
      line(x, y, x + v.x * k, y + v.y * k);
      noStroke();
      fill(255, 220, 100, 220);
      circle(x + v.x * k, y + v.y * k, 4);
    }

    // Centro de masa de los cuerpos dinámicos
    let totalMass = 0;
    let comX = 0;
    let comY = 0;
    for (const b of bodies) {
      if (b.isStatic) continue;
      totalMass += b.mass;
      comX += b.position.x * b.mass;
      comY += b.position.y * b.mass;
    }
    if (totalMass > 0) {
      comX /= totalMass;
      comY /= totalMass;
      stroke(255, 170, 220, 210);
      strokeWeight(1.6);
      line(comX - 10, comY, comX + 10, comY);
      line(comX, comY - 10, comX, comY + 10);
      noFill();
      circle(comX, comY, 17);
      noStroke();
      fill(255, 170, 220, 230);
      useText(11, true);
      textAlign(LEFT, BOTTOM);
      text('CM', comX + 12, comY - 8);
    }

    // Radio de los sensores
    noFill();
    stroke(120, 220, 255, 55);
    strokeWeight(1);
    for (const s of this.switches) {
      circle(s.position.x, s.position.y, s.game.r * 2);
    }
    for (const h of this.hearts) {
      circle(h.position.x, h.position.y, h.game.r * 2);
    }
    if (this.boss && this.boss.hp > 0) {
      circle(this.boss.body.position.x, this.boss.body.position.y, this.boss.r * 2);
    }

    // Capa didáctica de los campos: flechas de viento y empuje/peso.
    if (Fields.has(this.fields)) Fields.overlay(this.fields);

    // Panel de energía
    const hasFields = Fields.has(this.fields);
    const px = 388;
    const py = 20;
    const pw = 292;
    const ph = hasFields ? 102 : 82;
    noStroke();
    fill(10, 18, 26, 165);
    rect(px, py, pw, ph, 14);
    stroke(255, 255, 255, 26);
    strokeWeight(1.5);
    noFill();
    rect(px, py, pw, ph, 14);

    noStroke();
    useText(12, true);
    fill('#9fd9f4');
    textAlign(LEFT, TOP);
    text('FÍSICA · V', px + 16, py + 12);

    let lines;
    if (this.bird) {
      const speedPerStep = Math.hypot(this.bird.velocity.x, this.bird.velocity.y);
      const speed = speedPerStep * 60;
      const ec = 0.5 * this.bird.mass * speed * speed / 1000;
      const ep = this.bird.mass * gPx * (CONFIG.GROUND_Y - this.bird.position.y) / 1000;
      const typeId = this.bird.game ? this.bird.game.type : 'normal';
      const momentum = this.bird.mass * speedPerStep;
      lines = [
        `${typeId.toUpperCase()} · m ${this.bird.mass.toFixed(2)} · p=m·v ${momentum.toFixed(2)}`,
        `v ${speed.toFixed(0)} px/s   ·   Ec ${ec.toFixed(1)}   ·   Ep ${ep.toFixed(1)}`,
        `E ${(ec + ep).toFixed(1)}`
      ];
      if (hasFields) {
        // El trabajo se muestra en las mismas unidades que Ec y Ep.
        const work = this.fieldWork * 3.6;
        const sign = work >= 0 ? '+' : '';
        lines.push(
          `Wcampos ${sign}${work.toFixed(1)}   ·   Ec+Ep ya no se conserva`
        );
      }
    } else {
      lines = ['Sin proyectil en vuelo.', 'Dispara para ver energía y momento.'];
      if (hasFields) lines.push('Viento y agua hacen trabajo sobre el proyectil.');
    }

    useText(11, false);
    fill('#d7e8f2');
    for (let i = 0; i < lines.length; i++) {
      text(lines[i], px + 16, py + 34 + i * 18);
    }

    // Fuerza de la cuerda (tensión aproximada)
    for (const rope of this.ropes) {
      if (rope.cut || !rope.weight) continue;
      const d = distTo(rope.anchor.x, rope.anchor.y, rope.weight.position.x, rope.weight.position.y);
      const stretch = Math.max(0, d - rope.length);
      useText(10, true);
      fill(stretch > 4 ? '#ff9a8b' : '#9fd9f4');
      textAlign(CENTER, CENTER);
      text(`T ${stretch.toFixed(0)}`, (rope.anchor.x + rope.weight.position.x) / 2 + 18,
           (rope.anchor.y + rope.weight.position.y) / 2);
    }

    pop();
  }

  /* --------------------------- HUD --------------------------------- */

  drawAmmoIcon(x, y, typeId, scale = 1, alpha = 255, selected = false) {
    const type = AMMO_TYPES[typeId] || AMMO_TYPES.normal;
    const r = (typeId === 'heavy' ? 10 : 8.5) * scale;
    const bodyColor = color(type.color);
    bodyColor.setAlpha(alpha);
    const edgeColor = color(type.edge);
    edgeColor.setAlpha(alpha);

    push();
    if (selected) {
      noFill();
      stroke(255, 255, 255, alpha);
      strokeWeight(2);
      circle(x, y, (r + 5) * 2);
    }

    fill(bodyColor);
    stroke(edgeColor);
    strokeWeight(2 * scale);
    circle(x, y, r * 2);

    const mark = color('#fff4dc');
    mark.setAlpha(alpha);
    stroke(mark);
    fill(mark);
    strokeWeight(1.6 * scale);

    if (typeId === 'bounce') {
      noFill();
      arc(x, y, r * 2.35, r * 2.35, -2.5, -1.5);
      arc(x, y, r * 2.35, r * 2.35, 0.6, 1.6);
      line(x - r * 0.7, y - r * 0.3, x - r * 0.3, y - r * 0.6);
      line(x - r * 0.3, y - r * 0.6, x + r * 0.1, y - r * 0.3);
      line(x + r * 0.1, y - r * 0.3, x + r * 0.5, y - r * 0.6);
    } else if (typeId === 'explosive') {
      line(x + r * 0.25, y - r * 0.75, x + r * 0.75, y - r * 1.35);
      circle(x + r * 0.8, y - r * 1.4, 3 * scale);
    } else if (typeId === 'split') {
      noStroke();
      circle(x - r * 0.42, y, 2.8 * scale);
      circle(x, y - r * 0.38, 2.8 * scale);
      circle(x + r * 0.42, y, 2.8 * scale);
    } else if (typeId === 'rocket') {
      noStroke();
      triangle(
        x - r * 0.75, y - r * 0.35,
        x - r * 0.75, y + r * 0.35,
        x - r * 1.5, y
      );
      stroke(mark);
      line(x - r * 0.25, y - r * 0.45, x + r * 0.35, y - r * 0.45);
    } else if (typeId === 'heavy') {
      noFill();
      circle(x, y, r * 1.15);
    }
    pop();
  }

  drawHud() {
    push();
    rectMode(CORNER);
    textAlign(LEFT, TOP);
    this.ammoHitboxes = [];

    // panel izquierdo: nivel + puntos
    noStroke();
    fill(10, 18, 26, 165);
    rect(22, 20, 344, this.mode === 'adventure' ? 112 : 78, 14);
    stroke(255, 255, 255, 26);
    strokeWeight(1.5);
    noFill();
    rect(22, 20, 344, this.mode === 'adventure' ? 112 : 78, 14);
    if (this.themeActive) {
      noStroke();
      fill(this.theme.palette.accent);
      rect(24, 22, 340, 5, 4, 4, 0, 0);
    }

    noStroke();
    useText(13, true);
    fill('#8fb8d4');
    const infiniteInfo = this.infiniteRun || this.infiniteLastRun;
    if (this.mode === 'hardcore' && this.hardcoreRun) {
      this.drawSkull(34, 38, 15, '#8fb8d4');
      text(
        `RUN ${this.hardcoreRun.runNumber} · MUNDO ${this.levelWorld} · NIVEL ${this.levelNumber}`,
        48, 31
      );
      useText(10.5, true);
      fill('#ffb0a5');
      text(`UNA VIDA · ${this.hardcoreRun.levels}/60 SUPERADOS`, 42, 83);
    } else if (this.mode === 'infinite' && infiniteInfo) {
      text(`INFINITO ${infiniteInfo.depth} · ${this.levelName.toUpperCase()}`, 42, 31);
      useText(10.5, true);
      fill('#d8dcff');
      text(
        `RESERVA ${infiniteInfo.reserve} · DIFICULTAD ×${this.themeIntensity.toFixed(2)}`,
        42, 83
      );
    } else {
      text(`NIVEL ${this.levelNumber}/${this.levelTotal} · ${this.levelName.toUpperCase()}`, 42, 31);
    }

    if (this.mode === 'adventure') {
      const lifeY = 106;
      for (let i = 0; i < 5; i++) {
        this.drawHeartIcon(52 + i * 18, lifeY, 6, i < this.adventureLives);
      }
      useText(10.5, true);
      fill('#ffb0c0');
      textAlign(LEFT, CENTER);
      text(`VIDAS ${this.adventureLives}`, 148, lifeY);
      textAlign(LEFT, TOP);
    }

    useText(30, true);
    fill('#ffffff');
    text(nf(this.score, 5), 42, 49);

    useText(12, false);
    fill('#9fc4dc');
    text(this.mode === 'hardcore' && this.hardcoreRun
      ? `RUN ${this.hardcoreRun.score}`
      : (this.mode === 'infinite' && infiniteInfo
        ? `RACHA ${infiniteInfo.score}`
        : 'PUNTOS'), 150, 62);

    if (this.mode === 'infinite' && this.infiniteRun && this.infiniteRun.mutator) {
      useText(10, true);
      fill('#ffd166');
      text(this.infiniteRun.mutator.label.toUpperCase(), 42, 102);
    }

    // mejor resultado guardado para este nivel
    useText(11, true);
    fill('#ffd166');
    textAlign(RIGHT, TOP);
    text(`MEJOR ${this.bestStars}/5`, 350, 62);
    textAlign(LEFT, TOP);

    // panel derecho: munición + objetivos
    noStroke();
    fill(10, 18, 26, 165);
    rect(this.W - 366, 20, 344, 128, 14);
    stroke(255, 255, 255, 26);
    strokeWeight(1.5);
    noFill();
    rect(this.W - 366, 20, 344, 128, 14);
    if (this.themeActive) {
      noStroke();
      fill(this.theme.palette.accent);
      rect(this.W - 364, 22, 340, 5, 4, 4, 0, 0);
    }

    noStroke();
    useText(13, true);
    fill('#8fb8d4');
    text('MUNICIÓN', this.W - 346, 31);

    const ammoPanelX = this.W - 366;
    const ammoGap = Math.min(34, 270 / Math.max(1, this.shotsMax - 1));
    const ammoStart = ammoPanelX + 20 +
      Math.max(0, (270 - (this.shotsMax - 1) * ammoGap) / 2);
    for (let i = 0; i < this.shotsMax; i++) {
      const x = ammoStart + i * ammoGap;
      const y = 116;
      const pendingIndex = i - this.ammoUsed.length;
      const pending = pendingIndex >= 0 && pendingIndex < this.ammo.length;
      const typeId = pending
        ? this.ammo[pendingIndex]
        : (this.ammoUsed[i] || 'normal');
      const selected = pending && pendingIndex === this.ammoIndex;
      this.drawAmmoIcon(x, y, typeId, 0.9, pending ? 255 : 75, selected);
      if (pending) {
        this.ammoHitboxes.push({ x: x - 16, y: y - 17, w: 32, h: 34, index: pendingIndex });
      }
    }

    const available = new Set(this.availableAmmoTypes());
    if (available.size > 1) {
      const paletteY = 105;
      const paletteStart = this.W / 2 - ((AMMO_ORDER.length - 1) * 24) / 2;
      for (let i = 0; i < AMMO_ORDER.length; i++) {
        const typeId = AMMO_ORDER[i];
        const x = paletteStart + i * 24;
        const enabled = available.has(typeId);
        this.drawAmmoIcon(
          x, paletteY, typeId, 0.9, enabled ? 255 : 58,
          enabled && typeId === this.currentAmmoType()
        );
        useText(9, true);
        textAlign(CENTER, CENTER);
        fill(255, 255, 255, enabled ? 210 : 75);
        text(String(i + 1), x, 128);
        if (enabled) {
          this.ammoHitboxes.push({ x: x - 15, y: 86, w: 30, h: 48, type: typeId });
        }
      }
    }

    useText(13, true);
    fill('#8fb8d4');
    textAlign(RIGHT, TOP);

    if (this.goal.type === 'boss') {
      const hp = this.boss ? this.boss.hp : 0;
      const maxHp = this.boss ? this.boss.maxHp : 0;
      text(this.boss.name.toUpperCase(), this.W - 42, 31);
      useText(24, true);
      fill(hp <= 0 ? '#ffd166' : '#ffffff');
      text(`${hp}/${maxHp}`, this.W - 42, 48);

      useText(10, true);
      fill('#ffd166');
      text('GOLPES RESTANTES', this.W - 42, 75);
    } else if (this.goal.type === 'switch') {
      text('REACTOR', this.W - 42, 31);
      useText(24, true);
      fill(this.switchesActivated >= this.switchesTotal ? '#8ff09b' : '#ffffff');
      text(`${this.switchesActivated}/${this.switchesTotal}`, this.W - 42, 48);

      useText(10, true);
      fill('#ffd166');
      text(
        this.dominoes.length > 0
          ? `MEC. ${this.mechanismsTriggered} · CADENA x${this.dominoesTriggered}`
          : `MECANISMOS ${this.mechanismsTriggered}`,
        this.W - 42, 75
      );
    } else {
      text('OBJETIVOS', this.W - 42, 31);
      useText(24, true);
      fill(this.targets.length === 0 ? '#8ff09b' : '#ffffff');
      text(`${this.targets.length}/${this.totalTargets}`, this.W - 42, 48);
    }

    // Corazones opcionales: se muestran solo en niveles que los tienen.
    if (this.heartsTotal > 0) {
      const heartHudY = this.mode === 'adventure' ? 140 : 104;
      noStroke();
      fill(10, 18, 26, 150);
      rect(22, heartHudY, 174, 28, 10);
      stroke(255, 255, 255, 22);
      strokeWeight(1);
      noFill();
      rect(22, heartHudY, 174, 28, 10);

      noStroke();
      this.drawHeartIcon(43, heartHudY + 14, 8, this.heartsCollected > 0);
      useText(11, true);
      fill('#ffb0c0');
      textAlign(LEFT, CENTER);
      text(
        `CORAZONES ${this.heartsCollected}/${this.heartsTotal}`,
        60, heartHudY + 15
      );
      textAlign(LEFT, TOP);
    }

    // Campos: veleta y lectura de viento (si el nivel tiene viento).
    if (Fields.has(this.fields)) {
      const fieldsHudY = this.heartsTotal > 0
        ? (this.mode === 'adventure' ? 176 : 140)
        : (this.mode === 'adventure' ? 140 : 104);
      Fields.hud(this.fields, 22, fieldsHudY);
    }

    // barra de potencia
    if (this.phase === 'aiming' && this.dragging) {
      const v = this.launchVector();
      const power = clamp(Math.hypot(v.x, v.y) / CONFIG.MAX_SPEED, 0, 1);
      noStroke();
      fill(255, 255, 255, 22);
      rect(42, 78, 270, 10, 5);
      fill(power > 0.8 ? '#ff7a6b' : power > 0.45 ? '#ffd166' : '#7ddc8a');
      rect(42, 78, Math.max(8, 270 * power), 10, 5);
    }

    this.drawBossHud();

    // ayuda inferior
    textAlign(CENTER, BOTTOM);
    useText(13.5, false);
    fill(12, 22, 30, 120);
    const helpText = this.mode === 'classic'
      ? 'Arrastra y suelta para disparar   ·   V física   ·   R reinicia   ·   Esc menú   ·   M sonido   ·   1-6 niveles'
      : 'Arrastra y suelta para disparar   ·   R reinicia   ·   Esc menú   ·   M sonido';
    text(helpText, this.W / 2 + 1, this.H - 21);
    fill(255, 255, 255, 195);
    text(helpText, this.W / 2, this.H - 22);

    // indicador de silencio
    if (this.sfx.muted) {
      textAlign(RIGHT, BOTTOM);
      useText(12, true);
      fill(255, 255, 255, 140);
      text('SONIDO: OFF', this.W - 30, this.H - 22);
    }

    pop();
  }

  /** Barra de vida del jefe en la parte superior central. */
  drawBossHud() {
    if (!this.boss) return;

    const bw = 380;
    const bx = this.W / 2 - bw / 2;
    const by = 20;
    const bh = 58;
    const hp = this.boss.hp;
    const maxHp = this.boss.maxHp;
    const ratio = maxHp > 0 ? clamp(hp / maxHp, 0, 1) : 0;

    push();
    rectMode(CORNER);
    textAlign(CENTER, TOP);

    noStroke();
    fill(10, 18, 26, 175);
    rect(bx, by, bw, bh, 14);
    stroke(255, 255, 255, 26);
    strokeWeight(1.5);
    noFill();
    rect(bx, by, bw, bh, 14);

    noStroke();
    useText(12, true);
    fill('#ffb0a5');
    text(`JEFE · ${this.levelName.toUpperCase()}`, this.W / 2, by + 8);

    useText(10, true);
    fill('#ffd166');
    textAlign(RIGHT, TOP);
    text(`${hp}/${maxHp} GOLPES`, bx + bw - 16, by + 9);

    // barra
    noStroke();
    fill(255, 255, 255, 22);
    rect(bx + 16, by + 32, bw - 32, 12, 6);
    if (ratio > 0) {
      fill(this.boss.color);
      rect(bx + 16, by + 32, (bw - 32) * ratio, 12, 6);
      fill(255, 255, 255, 45);
      rect(bx + 16, by + 32, (bw - 32) * ratio, 4, 4);
    }

    useText(9.5, true);
    fill(255, 255, 255, 125);
    textAlign(CENTER, TOP);
    text('CADA GOLPE ALTERA SU POSICIÓN O EL CAMPO DE LA ARENA', this.W / 2, by + 47);

    pop();
  }

  drawBanner() {
    if (this.banner <= 0) return;
    const a = clamp(this.banner / 0.7, 0, 1);
    const hasSub = !!this.bannerSub;
    const h = hasSub ? 96 : 68;

    push();
    useText(34, true);
    textAlign(CENTER, CENTER);
    const w = Math.max(
      textWidth(this.bannerText) + 80,
      hasSub ? textWidth(this.bannerSub) + 110 : 0
    );

    rectMode(CENTER);
    noStroke();
    fill(10, 18, 26, 155 * a);
    rect(this.W / 2, 168, w, h, 16);

    fill(255, 255, 255, 235 * a);
    text(this.bannerText, this.W / 2, hasSub ? 148 : 170);

    if (hasSub) {
      useText(16, false);
      fill(255, 226, 150, 225 * a);
      text(this.bannerSub, this.W / 2, 186);
    }
    pop();
  }

  drawStarsRow(cx, cy, earned, total, size) {
    const gap = size * 2.55;
    const start = cx - ((total - 1) * gap) / 2;
    for (let i = 0; i < total; i++) {
      this.drawStarIcon(start + i * gap, cy, size, i < earned);
    }
  }

  drawStarIcon(x, y, r, filled) {
    push();
    translate(x, y);

    // sombra suave
    noStroke();
    fill(0, 0, 0, filled ? 55 : 25);
    ellipse(0, 3, r * 1.9, r * 0.62);

    if (filled) {
      fill('#ffd166');
      stroke('#c08a24');
    } else {
      fill(255, 255, 255, 16);
      stroke(255, 255, 255, 95);
    }
    strokeWeight(2);

    beginShape();
    for (let i = 0; i < 10; i++) {
      const a = -HALF_PI + (i * PI) / 5;
      const radius = i % 2 === 0 ? r : r * 0.46;
      vertex(cos(a) * radius, sin(a) * radius);
    }
    endShape(CLOSE);

    // brillo interior de las estrellas conseguidas
    if (filled) {
      noStroke();
      fill(255, 255, 255, 95);
      ellipse(-r * 0.22, -r * 0.26, r * 0.42, r * 0.28);
    }

    pop();
  }

  /** Resumen final de una racha de Infinito, previo al ranking. */
  drawInfiniteRecap(run) {
    noStroke();
    fill(6, 10, 16, 184);
    rect(0, 0, this.W, this.H);

    const pw = 640;
    const ph = 430;
    const px = (this.W - pw) / 2;
    const py = (this.H - ph) / 2;

    rectMode(CORNER);
    fill(17, 27, 39, 248);
    stroke('#e0796c');
    strokeWeight(3);
    rect(px, py, pw, ph, 22);

    noStroke();
    textAlign(CENTER, TOP);

    useText(15, true);
    fill('#ff9a8b');
    text('INFINITO · RACHA TERMINADA', this.W / 2, py + 24);

    useText(46, true);
    fill('#ffffff');
    text(`Nivel ${run.depth}`, this.W / 2, py + 50);

    useText(14, false);
    fill('#cfe4f2');
    text(`Semilla ${run.seed} · ${run.stars} estrellas · ${run.hearts} corazones`, this.W / 2, py + 108);

    useText(12, true);
    fill('#9fc4dc');
    text('PUNTOS DE LA RACHA', this.W / 2, py + 146);
    useText(42, true);
    fill('#ffd166');
    text(nf(run.score, 5), this.W / 2, py + 168);

    useText(14, false);
    fill('#dcecf7');
    const best = this.progress.getInfiniteBestDepth(run.seed);
    text(
      best > run.depth
        ? `Mejor de esta semilla: nivel ${best}`
        : 'Mejor marca de esta semilla',
      this.W / 2, py + 226
    );

    useText(15, true);
    fill('#9fc4dc');
    text(`Último nivel: ${this.levelName.toUpperCase()}`, this.W / 2, py + 258);

    const bx = this.W / 2 - 160;
    const by = py + 306;
    fill('#8f3a2f');
    rect(bx, by, 320, 54, 14);
    useText(17, true);
    fill('#ffffff');
    textAlign(CENTER, CENTER);
    text('CLIC / ESPACIO  ▸  VER RANKING', this.W / 2, by + 28);

    useText(12, false);
    fill(255, 255, 255, 145);
    textAlign(CENTER, TOP);
    text('La marca ya está guardada en el ranking global y en el de la semilla.', this.W / 2, by + 68);
  }

  drawOverlay() {
    if (this.phase !== 'won' && this.phase !== 'lost') return;

    const won = this.phase === 'won';

    if (this.mode === 'adventure' && !won) {
      this.drawAdventureLossOverlay();
      return;
    }

    if (this.mode === 'infinite' && !won && this.infiniteLastRun) {
      this.drawInfiniteRecap(this.infiniteLastRun);
      return;
    }

    noStroke();
    fill(6, 10, 16, 176);
    rect(0, 0, this.W, this.H);

    const pw = 640;
    const ph = 410;
    const px = (this.W - pw) / 2;
    const py = (this.H - ph) / 2;

    rectMode(CORNER);
    fill(17, 27, 39, 246);
    stroke(won ? '#7ddc8a' : '#e0796c');
    strokeWeight(3);
    rect(px, py, pw, ph, 22);

    noStroke();
    textAlign(CENTER, TOP);

    const isSwitch = this.goal.type === 'switch';
    const isBoss = this.goal.type === 'boss';

    useText(15, true);
    fill(won ? '#8ff09b' : '#ff9a8b');
    text(
      this.mode === 'hardcore'
        ? (won ? 'HARDCORE · NIVEL SUPERADO' : 'HARDCORE · RUN TERMINADA')
        : (won
          ? (isBoss ? 'JEFE DERROTADO' : (isSwitch ? 'REACTOR ACTIVADO' : 'NIVEL COMPLETADO'))
          : (isBoss ? 'EL GUARDIÁN RESISTE' : (isSwitch ? 'REACTOR INACTIVO' : 'SIN MUNICIÓN'))),
      this.W / 2, py + 22
    );

    useText(46, true);
    fill('#ffffff');
    text(
      this.mode === 'hardcore'
        ? (won
          ? (this.hardcoreRun && this.hardcoreRun.levels >= 60
            ? '¡Campaña completada!'
            : `¡${this.hardcoreRun ? this.hardcoreRun.levels : 0} niveles superados!`)
          : (this.hardcoreFailure === 'stars'
            ? 'Faltaron estrellas'
            : 'Una sola vida'))
        : (won
      ? (isBoss ? `¡${this.boss.name} vencido!` : (isSwitch ? '¡Cadena completada!' : '¡Torre derribada!'))
        : (isBoss ? 'Te faltaron golpes' : (isSwitch ? 'La cadena no llegó' : 'Te quedaste corto'))),
      this.W / 2, py + 44
    );

    // Estrellas del nivel y mejor marca guardada.
    this.drawStarsRow(this.W / 2, py + 108, won ? this.stars : 0, 5, 18);
    useText(13, true);
    fill('#ffd166');
    text(
      `${won ? this.stars : 0}/5 ESTRELLAS   ·   MEJOR ${this.bestStars}/5${this.newStars ? '   ·   ¡NUEVO!' : ''}`,
      this.W / 2, py + 132
    );

    useText(18, false);
    fill('#cfe4f2');
    if (won) {
      text(`Puntos del nivel: ${this.score}`, this.W / 2, py + 162);
      text(
        `Bonus por tiros sin usar: +${this.bonus}  (${this.shotsLeft} × ${CONFIG.SCORE_SHOT_BONUS})`,
        this.W / 2, py + 190
      );
      if (isSwitch || isBoss) {
        if (this.mode !== 'hardcore') {
          useText(14, false);
          fill('#9fc4dc');
          text(
            isBoss
              ? (this.heartsTotal > 0
                ? `Golpes al jefe: ${this.boss ? this.boss.maxHp : 0}   ·   Corazones: ${this.heartsCollected}/${this.heartsTotal}`
                : `Golpes al jefe: ${this.boss ? this.boss.maxHp : 0}`)
              : `Mecanismos: ${this.mechanismsTriggered}   ·   Cadena: ${this.dominoesTriggered} fichas`,
            this.W / 2, py + 216
          );
        }
      }
    } else if (isBoss) {
      text(
        `Golpes restantes: ${this.boss ? this.boss.hp : 0} de ${this.boss ? this.boss.maxHp : 0}`,
        this.W / 2, py + 162
      );
      text('El guardián se protege y cambia de posición. Busca un nuevo ángulo.', this.W / 2, py + 190);
    } else if (isSwitch) {
      text(
        `Reactores activados: ${this.switchesActivated} de ${this.switchesTotal}`,
        this.W / 2, py + 162
      );
      text('La reacción no llegó. Prueba otro punto de corte o de impacto.', this.W / 2, py + 190);
    } else {
      text(`Objetivos restantes: ${this.targets.length} de ${this.totalTargets}`, this.W / 2, py + 162);
      text('La estructura aguantó el impacto. Prueba otro ángulo.', this.W / 2, py + 190);
    }
    if (this.mode === 'hardcore') {
      useText(14, false);
      fill('#cfe4f2');
      text(
        `Run ${this.hardcoreRun ? this.hardcoreRun.runNumber : 0} · ` +
        `${this.hardcoreRun ? this.hardcoreRun.levels : 0}/60 niveles · ` +
        `${this.hardcoreRun ? this.hardcoreRun.score : 0} puntos`,
        this.W / 2, py + 218
      );
      if (this.hardcoreResult && this.hardcoreResult.best) {
        text(
          `Mejor: ${this.hardcoreResult.best.levels}/60 · ${this.hardcoreResult.best.score} puntos`,
          this.W / 2, py + 244
        );
      }
    }

    useText(16, true);
    fill('#9fc4dc');
    const recordY = (won && (isSwitch || isBoss)) ? py + 246 : py + 218;
    if (this.mode !== 'hardcore') {
      text(
        `RÉCORD DEL NIVEL: ${this.best}${this.newBest ? '   ·   ¡NUEVO RÉCORD!' : ''}`,
        this.W / 2, recordY
      );
    }

    // botón
    const bx = this.W / 2 - 150;
    const by = py + 276;
    fill(won ? '#2f8f4a' : '#8f3a2f');
    rect(bx, by, 300, 54, 14);

    useText(18, true);
    fill('#ffffff');
    textAlign(CENTER, CENTER);
    text(
      this.mode === 'hardcore'
        ? (won ? 'CLIC / ESPACIO  ▸  SIGUIENTE' : 'CLIC / ESPACIO  ▸  RESUMEN')
        : (won ? 'CLIC / ESPACIO  ▸  SIGUIENTE' : 'CLIC / R  ▸  REINTENTAR'),
      this.W / 2, by + 28
    );

    useText(13, false);
    fill(255, 255, 255, 130);
    text(
      this.mode === 'classic'
        ? `1-${LEVELS.length} cambia de nivel   ·   Esc menú`
        : (this.mode === 'hardcore'
          ? `Mínimo ${CONFIG.HARDCORE_MIN_STARS} estrellas · sin reinicio de nivel`
          : 'Esc menú'),
      this.W / 2, by + 62
    );
  }

  drawAdventureLossOverlay() {
    noStroke();
    fill(6, 10, 16, 184);
    rect(0, 0, this.W, this.H);

    const gameOver = this.adventureLives <= 0;
    const pw = 640;
    const ph = 340;
    const px = (this.W - pw) / 2;
    const py = (this.H - ph) / 2;

    rectMode(CORNER);
    fill(17, 27, 39, 248);
    stroke(gameOver ? '#e0796c' : '#f0a35e');
    strokeWeight(3);
    rect(px, py, pw, ph, 22);

    noStroke();
    textAlign(CENTER, TOP);
    useText(16, true);
    fill(gameOver ? '#ff9a8b' : '#ffd08b');
    text(gameOver ? 'AVENTURA · GAME OVER' : 'AVENTURA · VIDA PERDIDA', this.W / 2, py + 28);

    useText(42, true);
    fill('#ffffff');
    text(gameOver ? 'Se agotaron las vidas' : 'La estructura resistió', this.W / 2, py + 64);

    useText(18, false);
    fill('#cfe4f2');
    text(
      gameOver
        ? `El Mundo ${this.adventureWorld} comienza de nuevo con 5 vidas.`
        : `Te quedan ${this.adventureLives} vidas.`,
      this.W / 2, py + 128
    );
    text(
      gameOver
        ? `Volverás al nivel 1 del Mundo ${this.adventureWorld}.`
        : `Repetirás el nivel ${this.levelNumber} del Mundo ${this.adventureWorld}.`,
      this.W / 2, py + 158
    );

    for (let i = 0; i < 5; i++) {
      this.drawHeartIcon(this.W / 2 - 48 + i * 24, py + 211, 10, i < this.adventureLives);
    }

    const bx = this.W / 2 - 190;
    const by = py + 244;
    fill(gameOver ? '#8f3a2f' : '#b57636');
    rect(bx, by, 380, 52, 14);
    useText(17, true);
    fill('#ffffff');
    textAlign(CENTER, CENTER);
    text(
      gameOver ? 'CLIC / ESPACIO  ▸  NUEVA PARTIDA' : 'CLIC / ESPACIO  ▸  VOLVER AL MUNDO',
      this.W / 2, by + 27
    );
    useText(12, false);
    fill(255, 255, 255, 145);
    textAlign(CENTER, TOP);
    text('La campaña y las estrellas desbloqueadas se conservan.', this.W / 2, by + 62);
  }

  /* -------------------------- teclado ------------------------------ */

  keyPressed() {
    const k = (key || '').toLowerCase();

    // El sonido se puede cambiar desde cualquier pantalla.
    if (k === 'm') {
      this.sfx.ensure();
      this.sfx.toggle();
      return;
    }

    if (this.screen !== 'play') {
      this.screens.keyPressed(k, keyCode);
      return;
    }

    if (keyCode === 27 || k === 'escape') {
      if (this.dragging) this.resetAim();
      this.screens.openMenu();
      return;
    }

    if (k === 'r') {
      if (this.mode === 'hardcore') return;
      if (this.mode === 'infinite' && this.phase === 'lost') {
        this.screens.openInfinite();
        return;
      }
      this.restartLevel();
      return;
    }
    if (k === 'n') { this.nextLevel(); return; }
    if (k === 'v') { this.showPhysics = !this.showPhysics; return; }

    if (this.phase === 'flying' && (k === ' ' || keyCode === 32)) {
      this.tryManualSplit();
      return;
    }

    if ((this.phase === 'ready' || this.phase === 'reloading') &&
        this.availableAmmoTypes().length > 1 && k >= '1' && k <= '6') {
      this.selectAmmoType(AMMO_ORDER[Number(k) - 1]);
      return;
    }

    if (this.mode === 'classic' && k >= '1' && k <= '9') {
      const idx = Number(k) - 1;
      if (idx < LEVELS.length) {
        this.runActive = true;
        this.loadClassic(idx);
      }
      return;
    }

    if (keyCode === ENTER || keyCode === 32) {
      if (this.phase === 'won') this.nextLevel();
      else if (this.phase === 'lost') {
        if (this.mode === 'hardcore') this.screens.openHardcore();
        else if (this.mode === 'infinite') this.screens.openInfinite();
        else if (this.mode === 'adventure') this.restartLevel();
        else this.restartLevel();
      }
    }
  }
}
