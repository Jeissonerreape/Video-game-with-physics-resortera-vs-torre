/* Simulación headless que conduce Game.update() sin copiar su física. */
class SimulationJob {
  constructor(levelDef, shot, options = {}) {
    if (!levelDef || !Array.isArray(levelDef.bodies)) {
      throw new TypeError('levelDef debe contener bodies.');
    }
    if (!shot || !Number.isFinite(Number(shot.angle)) ||
        !Number.isFinite(Number(shot.power))) {
      throw new TypeError('shot.angle y shot.power deben ser números finitos.');
    }

    this.game = new Game({ elt: { style: {} } }, { headless: true });
    this.game.loadLevel(levelDef, {
      mode: options.mode || 'adventure',
      id: levelDef.id || 'simulation',
      index: Number.isFinite(options.index) ? options.index : 0,
      number: Number.isFinite(options.number) ? options.number : 1,
      total: Number.isFinite(options.total) ? options.total : 1,
      world: Number.isFinite(options.world)
        ? options.world
        : (Number.isFinite(levelDef.world) ? levelDef.world : 0),
      par: Number.isFinite(levelDef.par) ? levelDef.par : levelDef.shots - 1,
      theme: options.theme || levelDef.worldTheme || levelDef.theme,
      intensity: Number.isFinite(options.intensity) ? options.intensity : levelDef.intensity,
      gravityScale: options.gravityScale,
      massMultiplier: options.massMultiplier,
      mutator: options.mutator,
      reserveShots: options.reserveShots,
      screen: 'play'
    });

    this.definition = levelDef;
    this.shots = [shot].concat(Array.isArray(shot.extra) ? shot.extra : []);
    this.maxSteps = Math.max(1, Math.trunc(Number(options.maxSteps) || 60 * 50));
    this.graceSteps = options.skipGrace ? 0 :
      Math.max(0, Math.trunc(Number(options.graceSteps) || 180));
    this.phase = this.graceSteps ? 'grace' : 'shot';
    this.graceLiveCount = this.countLiveElements();
    this.selfDestruct = false;
    this.steps = 0;
    this.shotIndex = 0;
    this.delayRemaining = 0;
    this.shotSteps = 0;
    this.log = [];
    this.done = false;
    this.result = null;

    if (!this.graceSteps) this.fireCurrentShot();
  }

  countLiveElements() {
    const game = this.game;
    return game.blocks.filter((body) => !body.game.removed).length +
      game.targets.filter((body) => !body.game.removed).length +
      game.switches.filter((body) => !body.game.removed).length +
      (game.boss && game.boss.hp > 0 ? 1 : 0);
  }

  objectiveProgress() {
    const game = this.game;
    const destroyed = Math.max(0, game.totalTargets - game.targets.length);
    const switches = game.switches.filter((item) => item.game.activated).length;
    const boss = game.boss ? game.boss.maxHp - game.boss.hp : 0;
    return destroyed * 100 + switches * 100 + boss * 100 +
      game.mechanismsTriggered + game.dominoesTriggered;
  }

  fireCurrentShot() {
    if (this.shotIndex >= this.shots.length) {
      this.finish(false);
      return;
    }
    const source = this.shots[this.shotIndex];
    const actual = source.action && typeof source.action === 'object'
      ? Object.assign({}, source, source.action)
      : source;
    const angle = Number(actual.angle);
    const power = Number(actual.power);
    if (!Number.isFinite(angle) || !Number.isFinite(power)) {
      throw new TypeError('shot.angle y shot.power deben ser números finitos.');
    }
    const ammoType = actual.ammoType || this.game.currentAmmoType();
    if (!this.game.selectAmmoType(ammoType)) {
      throw new RangeError(`Munición no disponible: ${ammoType}`);
    }
    const radians = angle * Math.PI / 180;
    const stretch = Math.max(18, Math.min(125, power * 125));
    this.game.aim.x = CONFIG.FORK.x - Math.cos(radians) * stretch;
    this.game.aim.y = CONFIG.FORK.y + Math.sin(radians) * stretch;
    this.game.launch();
    this.shotSteps = 0;
    this.log.push({ event: 'shot', index: this.shotIndex + 1, angle, power, ammoType });
    this.phase = 'flight';
  }

  finish(won) {
    if (this.done) return;
    const game = this.game;
    this.done = true;
    this.phase = 'done';
    this.result = {
      won: !!won,
      shotsUsed: game.shotsUsed,
      score: game.score,
      selfDestruct: this.selfDestruct,
      steps: this.steps,
      log: this.log.slice()
    };
  }

  step(budget = 1) {
    const count = Math.max(1, Math.trunc(Number(budget) || 1));
    for (let i = 0; i < count && !this.done; i++) {
      if (this.steps >= this.maxSteps) {
        this.finish(false);
        break;
      }

      if (this.phase === 'delay') {
        if (this.delayRemaining > 0) {
          this.game.update(1 / 60);
          this.steps++;
          this.delayRemaining--;
          continue;
        }
        this.fireCurrentShot();
        continue;
      }

      this.game.update(1 / 60);
      this.steps++;

      if (this.phase === 'grace') {
        if (this.game.phase === 'won' || this.game.phase === 'lost' ||
            this.countLiveElements() < this.graceLiveCount) {
          this.selfDestruct = true;
          this.finish(this.game.phase === 'won');
          continue;
        }
        this.graceSteps--;
        if (this.graceSteps <= 0) this.fireCurrentShot();
        continue;
      }

      if (this.phase !== 'flight') continue;
      this.shotSteps++;
      if (this.game.phase === 'won' || this.game.phase === 'lost') {
        this.log.push({
          event: 'shot-result',
          index: this.shotIndex + 1,
          phase: this.game.phase,
          score: this.game.score,
          progress: this.objectiveProgress()
        });
        if (this.game.phase === 'won') {
          this.finish(true);
          continue;
        }
        this.shotIndex++;
        this.finish(false);
        continue;
      }

      if (this.game.phase === 'ready') {
        this.log.push({
          event: 'shot-result',
          index: this.shotIndex + 1,
          phase: this.game.phase,
          score: this.game.score,
          progress: this.objectiveProgress()
        });
        this.shotIndex++;
        if (this.shotIndex >= this.shots.length) {
          this.finish(false);
        } else {
          const next = this.shots[this.shotIndex];
          this.delayRemaining = Math.max(0, Math.trunc(Number(next.stepDelay) || 0));
          this.phase = this.delayRemaining ? 'delay' : 'shot';
          if (!this.delayRemaining) this.fireCurrentShot();
        }
      }
    }
    return this.result;
  }
}

function simulateLevel(levelDef, shot, options = {}) {
  let selfDestruct = false;
  if (!options.skipGrace) {
    const grace = new SimulationJob(levelDef, shot, {
      mode: options.mode,
      index: options.index,
      number: options.number,
      total: options.total,
      world: options.world,
      theme: options.theme,
      intensity: options.intensity,
      gravityScale: options.gravityScale,
      massMultiplier: options.massMultiplier,
      mutator: options.mutator,
      graceSteps: 180,
      maxSteps: 180
    });
    while (!grace.done) grace.step(512);
    selfDestruct = grace.selfDestruct;
    if (selfDestruct) return grace.result;
  }
  const job = new SimulationJob(levelDef, shot, Object.assign({}, options, { skipGrace: true }));
  while (!job.done) job.step(512);
  job.result.selfDestruct = selfDestruct;
  return job.result;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SimulationJob, simulateLevel };
}
