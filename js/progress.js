/* =====================================================================
   Resortera vs. Torre — PROGRESO Y GUARDADO
   ---------------------------------------------------------------------
   Mantiene en localStorage:
     - estrellas y récord de cada nivel de Aventura
     - estrellas y récord de los niveles Clásicos
     - mejor run de Hardcore
     - ranking local del modo Infinito

   La estructura está versionada para poder migrar sin perder datos.
   ===================================================================== */

const SAVE_VERSION = 2;

function progressClampInt(value, min, max, fallback = 0) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function progressSanitizeLevels(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;

  for (const id of Object.keys(raw)) {
    const item = raw[id];
    if (!item || typeof item !== 'object') continue;
    out[id] = {
      stars: progressClampInt(item.stars, 0, 5, 0),
      best: Math.max(0, Math.trunc(Number(item.best)) || 0)
    };
  }
  return out;
}

function progressSanitizeRun(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    runNumber: progressClampInt(raw.runNumber, 1, 2147483647, 1),
    world: progressClampInt(raw.world, 1, 5, 1),
    level: progressClampInt(raw.level, 1, 12, 1),
    levels: progressClampInt(raw.levels, 0, 60, 0),
    score: Math.max(0, Math.trunc(Number(raw.score)) || 0),
    stars: progressClampInt(raw.stars, 0, 300, 0),
    bosses: progressClampInt(raw.bosses, 0, 5, 0),
    date: typeof raw.date === 'string' ? raw.date.slice(0, 24) : ''
  };
}

function progressSanitizeInfiniteEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    seed: progressClampInt(raw.seed, 0, 4294967295, 0),
    depth: Math.max(0, Math.trunc(Number(raw.depth)) || 0),
    score: Math.max(0, Math.trunc(Number(raw.score)) || 0),
    stars: Math.max(0, Math.trunc(Number(raw.stars)) || 0),
    date: typeof raw.date === 'string' ? raw.date.slice(0, 24) : ''
  };
}

function progressSanitizeInfiniteRun(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    seed: progressClampInt(raw.seed, 0, 4294967295, 0),
    depth: Math.max(1, Math.trunc(Number(raw.depth)) || 1),
    score: Math.max(0, Math.trunc(Number(raw.score)) || 0),
    stars: Math.max(0, Math.trunc(Number(raw.stars)) || 0),
    reserve: progressClampInt(raw.reserve, 0, 5, 3)
  };
}

function progressSortRuns(list) {
  return list.sort((a, b) => b.levels - a.levels || b.score - a.score ||
    (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function progressDefaultData() {
  return {
    version: SAVE_VERSION,
    adventure: {
      levels: {},
      unlockedWorld: 1,
      unlockedLevel: 1
    },
    classic: {
      levels: {}
    },
    hardcore: {
      bestWorld: 1,
      bestLevel: 1,
      bestScore: 0,
      bestRun: null,
      history: [],
      currentRun: null,
      runCounter: 0
    },
    infinite: {
      bestDepth: 0,
      leaderboard: [],
      bySeed: {},
      currentRun: null
    }
  };
}

class Progress {
  constructor() {
    this.key = CONFIG.SAVE_KEY || 'resortera_vs_torre_save_v2';
    this.data = this.load();
  }

  defaults() {
    return progressDefaultData();
  }

  load() {
    const base = this.defaults();

    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return base;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return base;

      const adventure = parsed.adventure && typeof parsed.adventure === 'object'
        ? parsed.adventure
        : {};
      const classic = parsed.classic && typeof parsed.classic === 'object'
        ? parsed.classic
        : {};
      const hardcore = parsed.hardcore && typeof parsed.hardcore === 'object'
        ? parsed.hardcore
        : {};
      const infinite = parsed.infinite && typeof parsed.infinite === 'object'
        ? parsed.infinite
        : {};

      base.adventure.levels = progressSanitizeLevels(adventure.levels);
      base.adventure.unlockedWorld = progressClampInt(adventure.unlockedWorld, 1, 5, 1);
      base.adventure.unlockedLevel = progressClampInt(adventure.unlockedLevel, 1, 12, 1);

      base.classic.levels = progressSanitizeLevels(classic.levels);

      base.hardcore.bestWorld = progressClampInt(hardcore.bestWorld, 1, 5, 1);
      base.hardcore.bestLevel = progressClampInt(hardcore.bestLevel, 1, 12, 1);
      base.hardcore.bestScore = Math.max(0, Math.trunc(Number(hardcore.bestScore)) || 0);
      base.hardcore.bestRun = progressSanitizeRun(hardcore.bestRun);
      base.hardcore.history = Array.isArray(hardcore.history)
        ? hardcore.history.map(progressSanitizeRun).filter(Boolean).slice(0, 10)
        : [];
      base.hardcore.currentRun = progressSanitizeRun(hardcore.currentRun);
      base.hardcore.runCounter = progressClampInt(hardcore.runCounter, 0, 2147483647, 0);

      base.infinite.bestDepth = Math.max(0, Math.trunc(Number(infinite.bestDepth)) || 0);
      base.infinite.currentRun = progressSanitizeInfiniteRun(infinite.currentRun);
      if (Array.isArray(infinite.leaderboard)) {
        base.infinite.leaderboard = infinite.leaderboard
          .map(progressSanitizeInfiniteEntry)
          .filter(Boolean)
          .sort((a, b) => b.depth - a.depth || b.score - a.score)
          .slice(0, 10);
      }
      if (infinite.bySeed && typeof infinite.bySeed === 'object' &&
          !Array.isArray(infinite.bySeed)) {
        for (const key of Object.keys(infinite.bySeed)) {
          if (!/^\d+$/.test(key)) continue;
          const entries = infinite.bySeed[key];
          if (!Array.isArray(entries)) continue;
          base.infinite.bySeed[key] = entries
            .map(progressSanitizeInfiniteEntry)
            .filter((entry) => entry && String(entry.seed) === key)
            .sort((a, b) => b.depth - a.depth || b.score - a.score)
            .slice(0, 10);
        }
      }

      return base;
    } catch (e) {
      return base;
    }
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch (e) {
      /* localStorage lleno o modo privado: el juego sigue sin guardar */
    }
  }

  /** Devuelve { stars, best } de un nivel. */
  getLevel(mode, id) {
    if (!id) return { stars: 0, best: 0 };
    const bucket = mode === 'adventure'
      ? this.data.adventure
      : (mode === 'classic' ? this.data.classic : null);
    if (!bucket) return { stars: 0, best: 0 };
    const item = bucket.levels[id];
    if (!item) return { stars: 0, best: 0 };
    return { stars: item.stars, best: item.best };
  }

  getBest(mode, id) {
    return this.getLevel(mode, id).best;
  }

  getStars(mode, id) {
    return this.getLevel(mode, id).stars;
  }

  /**
   * Guarda el resultado de un nivel.
   * Devuelve el récord y las estrellas que quedan tras el máximo.
   */
  recordLevel(mode, id, result) {
    const score = Math.max(0, Math.trunc(Number(result.score)) || 0);
    const stars = progressClampInt(result.stars, 0, 5, 0);

    // Hardcore no guarda estrellas por nivel: la run se guarda aparte.
    if (mode === 'hardcore') {
      return { best: score, stars, newBest: true, newStars: stars > 0 };
    }

    const bucket = mode === 'adventure'
      ? this.data.adventure
      : (mode === 'classic' ? this.data.classic : null);
    if (!bucket || !id) return { best: score, stars, newBest: false, newStars: false };

    const previous = bucket.levels[id] || { stars: 0, best: 0 };
    const newBest = score > previous.best;
    const newStars = stars > previous.stars;

    bucket.levels[id] = {
      stars: Math.max(previous.stars, stars),
      best: Math.max(previous.best, score)
    };

    this.save();

    return {
      best: bucket.levels[id].best,
      stars: bucket.levels[id].stars,
      newBest,
      newStars
    };
  }

  /** Estrellas de todos los niveles de un modo (por defecto Aventura). */
  getTotalStars(mode = 'adventure') {
    const bucket = mode === 'adventure' ? this.data.adventure : this.data.classic;
    let total = 0;
    for (const id of Object.keys(bucket.levels)) {
      total += progressClampInt(bucket.levels[id].stars, 0, 5, 0);
    }
    return total;
  }

  /** Estrellas de un mundo concreto (los ids son "mundo-nivel"). */
  getWorldStars(world) {
    let total = 0;
    const prefix = `${world}-`;
    for (const id of Object.keys(this.data.adventure.levels)) {
      if (id.startsWith(prefix)) {
        total += progressClampInt(this.data.adventure.levels[id].stars, 0, 5, 0);
      }
    }
    return total;
  }

  /** Desbloquea el siguiente nivel de Aventura. Se usará en la fase 2/3. */
  unlockNext(world, level) {
    const nextLevel = level + 1;
    const nextWorld = world + 1;
    const current = this.data.adventure;

    if (nextLevel <= 12) {
      if (current.unlockedWorld < world) return;
      if (current.unlockedWorld === world) {
        current.unlockedLevel = Math.max(current.unlockedLevel, nextLevel);
      }
    } else if (nextWorld <= 5) {
      // Al terminar el nivel 12 de un mundo se abre el siguiente mundo
      // desde su nivel 1, no desde el nivel 12 del mundo anterior.
      if (current.unlockedWorld <= world) {
        current.unlockedWorld = nextWorld;
        current.unlockedLevel = 1;
      }
    }

    this.save();
  }

  /** Crea y persiste una nueva run de Hardcore. */
  beginHardcoreRun() {
    const data = this.data.hardcore;
    data.runCounter++;
    data.currentRun = {
      runNumber: data.runCounter,
      world: 1,
      level: 1,
      levels: 0,
      score: 0,
      stars: 0,
      bosses: 0,
      date: new Date().toISOString().slice(0, 10)
    };
    this.save();
    return { ...data.currentRun };
  }

  /** Guarda solo el punto de reanudación entre niveles de Hardcore. */
  saveHardcoreCheckpoint(run) {
    if (!run || !this.data.hardcore.currentRun) return;
    this.data.hardcore.currentRun = progressSanitizeRun(run);
    this.data.hardcore.runCounter = Math.max(
      this.data.hardcore.runCounter,
      this.data.hardcore.currentRun.runNumber
    );
    this.save();
  }

  /** Finaliza la run de Hardcore, actualiza récord e historial y la limpia. */
  finishHardcoreRun(run) {
    const completed = progressSanitizeRun(run);
    if (!completed) return null;
    const data = this.data.hardcore;
    data.history.unshift(completed);
    data.history = data.history.slice(0, 10);

    const previous = data.bestRun || {
      levels: 0,
      score: data.bestScore
    };
    const better = completed.levels > previous.levels ||
      (completed.levels === previous.levels && completed.score > previous.score);
    if (better) data.bestRun = { ...completed };
    data.bestWorld = completed.levels >= 60 ? 5 : Math.max(1, Math.floor(completed.levels / 12) + 1);
    data.bestLevel = completed.levels >= 60 ? 12 : Math.max(1, completed.levels % 12 + 1);
    data.bestScore = data.bestRun ? data.bestRun.score : data.bestScore;
    data.currentRun = null;
    this.save();
    return { better, best: data.bestRun, history: data.history.slice() };
  }

  /** Guarda la mejor run de Hardcore para compatibilidad con llamadas anteriores. */
  recordHardcoreRun(world, level, score) {
    const w = progressClampInt(world, 1, 5, 1);
    const l = progressClampInt(level, 1, 12, 1);
    const s = Math.max(0, Math.trunc(Number(score)) || 0);
    const best = this.data.hardcore;

    const better = (w > best.bestWorld) ||
      (w === best.bestWorld && l > best.bestLevel) ||
      (w === best.bestWorld && l === best.bestLevel && s > best.bestScore);

    if (better) {
      best.bestWorld = w;
      best.bestLevel = l;
      best.bestScore = s;
      this.save();
    }

    return { ...best };
  }

  /** Añade una entrada al ranking global y al ranking de su semilla. */
  addInfiniteScore(entry) {
    const seed = progressClampInt(entry.seed, 0, 4294967295, 0);
    const depth = Math.max(0, Math.trunc(Number(entry.depth)) || 0);
    const score = Math.max(0, Math.trunc(Number(entry.score)) || 0);
    const date = typeof entry.date === 'string' && entry.date
      ? entry.date.slice(0, 24)
      : new Date().toISOString().slice(0, 10);

    const item = {
      seed,
      depth,
      score,
      stars: Math.max(0, Math.trunc(Number(entry.stars)) || 0),
      date
    };
    const data = this.data.infinite;
    const bySeed = data.bySeed[String(seed)] || [];
    bySeed.push(item);
    data.bySeed[String(seed)] = bySeed
      .sort((a, b) => b.depth - a.depth || b.score - a.score)
      .slice(0, 10);
    data.leaderboard.push(item);
    data.leaderboard.sort((a, b) => b.depth - a.depth || b.score - a.score ||
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    data.leaderboard = data.leaderboard.slice(0, 10);
    data.bestDepth = Math.max(data.bestDepth, depth);
    this.save();

    return data.leaderboard.indexOf(item);
  }

  getLeaderboard(seed) {
    const source = seed === undefined || seed === null
      ? this.data.infinite.leaderboard
      : (this.data.infinite.bySeed[String(progressClampInt(seed, 0, 4294967295, 0))] || []);
    return source.slice();
  }

  getInfiniteBestDepth(seed) {
    return this.getLeaderboard(seed).reduce((best, entry) => Math.max(best, entry.depth), 0);
  }

  saveInfiniteRun(run) {
    this.data.infinite.currentRun = progressSanitizeInfiniteRun(run);
    this.save();
  }

  getInfiniteRun() {
    return this.data.infinite.currentRun
      ? { ...this.data.infinite.currentRun }
      : null;
  }

  clearInfiniteRun() {
    this.data.infinite.currentRun = null;
    this.save();
  }
}
