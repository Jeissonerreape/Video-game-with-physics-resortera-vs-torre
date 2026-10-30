'use strict';

const assert = require('assert');
const vm = require('vm');
const { getLevels, simulate, generate, mutatorForRun, loadRuntime } = require('./sim.js');

const levels = getLevels();
assert.strictEqual(levels.length, 60, 'campaign should expose 60 levels');
assert(levels.every((level) => level.ready && Array.isArray(level.bodies) && level.bodies.length),
  'all campaign levels should have playable bodies');
assert(levels.every((level) => Array.isArray(level.ammo) && level.ammo.length === level.shots),
  'ammo count should match each level shot count');
assert(levels.filter((level) => level.index === 12).every((level) => level.boss.hp === 3),
  'each campaign boss should have three hit points');

const level = levels.find((item) => item.id === '2-1');
const shot = {
  angle: 30.5,
  power: 0.9142857142857143,
  ammoType: 'normal'
};
const first = simulate(level, shot);
const second = simulate(level, shot);
assert.strictEqual(JSON.stringify(first), JSON.stringify(second),
  'replaying the same shot sequence must be bit-for-bit deterministic');
assert.strictEqual(first.won, true, 'the reference smoke shot for 2-1 should win');

const sequence = simulate(level, {
  angle: 40,
  power: 0.85,
  ammoType: 'normal',
  extra: [{
    stepDelay: 0,
    action: { angle: 5, power: 1, ammoType: 'normal' }
  }]
});
assert.strictEqual(sequence.won, true, 'extra shot actions should be simulated');
assert.strictEqual(sequence.shotsUsed, 2);

const seeds = [0x5A17C0DE, 1, 42, 0xFFFFFFFF, 20261025];
const fieldKeyMap = {
  wind: 'wind',
  water: 'water',
  movers: 'movers',
  wells: 'well',
  magnets: 'magnet',
  thermal: 'thermal'
};
for (const seed of seeds) {
  const structuresSeen = new Set();
  const fieldsSeen = new Set();
  for (let index = 1; index <= 30; index++) {
    const left = generate(seed, index);
    const right = generate(seed, index);
    assert.strictEqual(JSON.stringify(left), JSON.stringify(right),
      `seed ${seed}, level ${index} should be identical across generations`);
    assert(left.meta.spent <= left.meta.budget + 1,
      `seed ${seed}, level ${index} must stay within one budget point`);
    assert.strictEqual(left.def.ammo.length, left.def.shots,
      `seed ${seed}, level ${index} must declare one ammo item per shot`);
    structuresSeen.add(left.def.structure);
    const actualFields = Object.keys(left.def.fields || {})
      .map((key) => fieldKeyMap[key])
      .filter(Boolean)
      .sort();
    actualFields.forEach((field) => fieldsSeen.add(field));
    assert.strictEqual(left.meta.fields.slice().sort().join(','), actualFields.join(','),
      `seed ${seed}, level ${index} metadata must describe the fields actually loaded`);
    if (left.meta.archetype === 'reactor') {
      assert.strictEqual(
        left.def.bodies.filter((body) => body.t === 'switch').length,
        1,
        `seed ${seed}, level ${index} should have one clear reactor objective`
      );
    }
    if (left.def.goal.type === 'destroyAll') {
      const targets = left.def.bodies.filter((body) => body.t === 'target').length;
      assert(targets > 0, `seed ${seed}, level ${index} should have a demolition target`);
      assert.strictEqual(left.def.targetCount, targets,
        `seed ${seed}, level ${index} must count the real objectives`);
    }
  }
  assert(structuresSeen.size >= 5,
    `seed ${seed} should vary the generated structure templates`);
  assert(fieldsSeen.size >= 4,
    `seed ${seed} should use a varied set of physical fields`);
}
const limitedAmmoLevel = generate(20261025, 40);
assert.strictEqual(limitedAmmoLevel.meta.mutator.id, 'limited-ammo',
  'seed 20261025 level 40 must keep exercising the limited-ammo mutator');
assert(limitedAmmoLevel.def.ammo.includes('rocket'),
  'limited ammo must preserve advanced projectiles such as the rocket');
assert.strictEqual(limitedAmmoLevel.def.ammo.length, limitedAmmoLevel.def.shots,
  'limited ammo must keep the ammo list aligned with the shot count');
const bossLevel = generate(20261025, 40);
assert.strictEqual(bossLevel.def.goal.type, 'boss',
  'seed 20261025 level 40 must exercise a generated boss');
assert.strictEqual(bossLevel.meta.intensity, 1.5,
  'infinite bosses must keep the base intensity of their world');
assert(bossLevel.meta.intensity < Math.min(2.5, 1 + 0.035 * 40),
  'infinite bosses must not scale their fields with depth intensity');

const difficultyCheckpoints = [1, 8, 16, 24, 32, 48, 56]
  .map((depth) => ({ depth, ...generate(20261025, depth) }));
for (let i = 1; i < difficultyCheckpoints.length; i++) {
  const previous = difficultyCheckpoints[i - 1];
  const current = difficultyCheckpoints[i];
  assert(current.meta.intensity > previous.meta.intensity,
    `infinite intensity should increase from depth ${previous.depth} to ${current.depth}`);
  assert(current.meta.budget >= previous.meta.budget,
    `infinite structure budget should not decrease from depth ${previous.depth} to ${current.depth}`);
  assert(current.meta.challenge >= previous.meta.challenge,
    `infinite structure challenge should not decrease from depth ${previous.depth} to ${current.depth}`);
}
for (const checkpoint of difficultyCheckpoints) {
  const maxFields = checkpoint.depth <= 5 ? 1 :
    (checkpoint.depth <= 15 ? 2 : (checkpoint.depth <= 30 ? 3 : 4));
  const mutatorAddsWind = checkpoint.meta.mutator.id === 'permanent-wind';
  assert(checkpoint.meta.fields.length <= maxFields + Number(mutatorAddsWind),
    `depth ${checkpoint.depth} should respect its tiered field limit`);
}

const simulationRuntime = loadRuntime();
const forwarded = vm.runInContext(`(() => {
  const level = generate(1, 6).def;
  const job = new SimulationJob(level, { angle: 45, power: 0.7, ammoType: 'normal' }, {
    mode: 'infinite',
    gravityScale: 0.7,
    massMultiplier: 1.5,
    mutator: 'heavy-projectiles',
    skipGrace: true
  });
  return {
    gravityScale: job.game.levelMeta.gravityScale,
    massMultiplier: job.game.levelMeta.massMultiplier,
    mutator: job.game.levelMeta.mutator,
    engineGravity: job.game.engine.gravity.y,
    density: job.game.ammoBodySpec('normal').density,
    normalDensity: MATERIALS.bird.density
  };
})()`, simulationRuntime);
assert.strictEqual(forwarded.gravityScale, 0.7,
  'SimulationJob must forward the gravity mutator to loadLevel');
assert.strictEqual(forwarded.massMultiplier, 1.5,
  'SimulationJob must forward the mass mutator to loadLevel');
assert.strictEqual(forwarded.mutator, 'heavy-projectiles',
  'SimulationJob must forward the mutator id to loadLevel');
assert(Math.abs(forwarded.engineGravity - 2.2 * 0.7) < 1e-9,
  'the simulated engine must use the mutator gravity scale');
assert(Math.abs(forwarded.density - forwarded.normalDensity * 1.5) < 1e-9,
  'the simulated projectile must use the mutator mass multiplier');

const ammoRuntime = loadRuntime();
const ammoDiagnostics = vm.runInContext(`(() => {
  const game = new Game({ elt: { style: {} } }, { headless: true });
  return game.runAmmoTests();
})()`, ammoRuntime);
assert.strictEqual(ammoDiagnostics.ok, true,
  'special projectile physics diagnostics should pass');
assert(ammoDiagnostics.explosion.ratio > 10,
  'explosion force should fall off clearly with distance');
assert(ammoDiagnostics.rocket.speedAfter > ammoDiagnostics.rocket.speedBefore,
  'rocket thrust should increase projectile speed');
assert(ammoDiagnostics.bounce.bounceVy < ammoDiagnostics.bounce.normalVy,
  'bounce ammo should rebound with greater speed than a normal projectile');

const projectileEffects = vm.runInContext(`(() => {
  const createGame = (ammo, bodies) => {
    const game = new Game({ elt: { style: {} } }, { headless: true });
    game.loadLevel({
      name: 'projectile effect test',
      shots: 1,
      ammo: [ammo],
      bodies,
      goal: { type: 'destroyAll' }
    }, { mode: 'classic' });
    game.aim = { x: CONFIG.FORK.x - 100, y: CONFIG.FORK.y };
    game.launch();
    return game;
  };

  const splitGame = createGame('split', []);
  const source = splitGame.bird;
  const momentumBefore = {
    x: source.mass * source.velocity.x,
    y: source.mass * source.velocity.y
  };
  splitGame.performSplit(source);
  const momentumAfter = splitGame.birds.reduce((sum, bird) => ({
    x: sum.x + bird.mass * bird.velocity.x,
    y: sum.y + bird.mass * bird.velocity.y
  }), { x: 0, y: 0 });
  const splitError = Math.hypot(
    momentumAfter.x - momentumBefore.x,
    momentumAfter.y - momentumBefore.y
  ) / Math.hypot(momentumBefore.x, momentumBefore.y);

  const explosiveGame = createGame('explosive', [{ t: 'target', x: 200, y: 470 }]);
  const explosive = explosiveGame.bird;
  const target = explosiveGame.targets[0];
  Matter.Body.setPosition(target, { x: explosive.position.x + 8, y: explosive.position.y });
  const contactTriggered = explosiveGame.handleAmmoContact(explosive, target, 8);
  explosiveGame.afterAmmoStep();

  return {
    splitCount: splitGame.birds.length,
    splitSourceRemoved: source.game.removed,
    splitError,
    explosionTriggered: contactTriggered && explosive.game.exploded,
    explosionDamagedTarget: target.game.hp < TARGET.hp
  };
})()`, ammoRuntime);
assert.strictEqual(projectileEffects.splitCount, 3,
  'a split projectile should create three active bodies');
assert.strictEqual(projectileEffects.splitSourceRemoved, true,
  'splitting should remove the original body');
assert(projectileEffects.splitError < 0.001,
  'splitting should preserve projectile momentum in the live physics bodies');
assert.strictEqual(projectileEffects.explosionTriggered, true,
  'an explosive projectile should detonate on a qualifying collision');
assert.strictEqual(projectileEffects.explosionDamagedTarget, true,
  'an explosive collision should damage nearby objectives');

const adventureRuntime = loadRuntime();
adventureRuntime.TWO_PI = Math.PI * 2;
const adventureLives = vm.runInContext(`(() => {
  const game = new Game({ elt: { style: {} } }, { headless: true });
  const start = Object.assign({}, getCampaignLevel(2, 4), {
    hearts: [{ id: 'life-a', x: 700, y: 330 }, { id: 'life-b', x: 740, y: 330 }]
  });
  if (!game.startCampaignLevel(start)) throw new Error('Adventure level did not start');
  const initialLives = game.adventureLives;
  const initialAmmo = game.ammo.length;
  game.collectHeart(game.hearts[0]);
  game.collectHeart(game.hearts[0]);
  const livesAfterHearts = game.adventureLives;
  const ammoAfterHearts = game.ammo.length;
  game.lose();
  const livesAfterFailure = game.adventureLives;
  game.lose();
  const livesAfterRepeatedLose = game.adventureLives;
  game.restartLevel();
  game.collectHeart(game.hearts[0]);
  game.collectHeart(game.hearts[0]);
  const livesAfterRecollectingHearts = game.adventureLives;
  const restart = { world: game.levelWorld, level: game.levelNumber, lives: game.adventureLives };

  game.nextLevel();
  const next = { world: game.levelWorld, level: game.levelNumber, lives: game.adventureLives };

  game.adventureLives = 1;
  game.lose();
  const gameOver = game.adventureLives === 0 && game.phase === 'lost';
  game.restartLevel();
  return {
    initialLives,
    initialAmmo,
    livesAfterHearts,
    ammoAfterHearts,
    livesAfterFailure,
    livesAfterRepeatedLose,
    livesAfterRecollectingHearts,
    restart,
    next,
    gameOver,
    newRun: { world: game.levelWorld, level: game.levelNumber, lives: game.adventureLives },
    lifeHeartKeysAfterNewRun: game.adventureLifeHeartsCollected.size
  };
})()`, adventureRuntime);
assert.strictEqual(adventureLives.initialLives, 5,
  'an Adventure run should start with five lives');
assert.strictEqual(adventureLives.livesAfterHearts, 7,
  'Adventure hearts should raise lives above five without a cap');
assert.strictEqual(adventureLives.ammoAfterHearts, adventureLives.initialAmmo + 2,
  'Adventure hearts should keep granting their extra shots');
assert.strictEqual(adventureLives.livesAfterFailure, 6,
  'failing a level should consume one Adventure life');
assert.strictEqual(adventureLives.livesAfterRepeatedLose, 6,
  'a single failure should not consume multiple lives');
assert.strictEqual(adventureLives.livesAfterRecollectingHearts, 6,
  'restarting a level must not grant its Adventure heart lives more than once per run');
assert.strictEqual(
  `${adventureLives.restart.world}/${adventureLives.restart.level}/${adventureLives.restart.lives}`,
  '2/4/6',
  'losing one life should restart the same Adventure level'
);
assert.strictEqual(
  `${adventureLives.next.world}/${adventureLives.next.level}/${adventureLives.next.lives}`,
  '2/5/6',
  'progressing in Adventure should preserve remaining lives'
);
assert.strictEqual(adventureLives.gameOver, true,
  'losing the final life should enter the Game Over state');
assert.strictEqual(
  `${adventureLives.newRun.world}/${adventureLives.newRun.level}/${adventureLives.newRun.lives}`,
  '2/1/5',
  'starting again after Game Over should reset at level one of the same world'
);
assert.strictEqual(adventureLives.lifeHeartKeysAfterNewRun, 0,
  'a new Adventure run should allow its life hearts to be collected again');

const seed = seeds[0];
assert.strictEqual(mutatorForRun(seed, 1), mutatorForRun(seed, 5),
  'the infinite mutator should stay fixed for each five-level segment');
assert(mutatorForRun(seed, 6).id,
  'the next five-level segment should have a deterministic mutator');

const progressRuntime = loadRuntime();
progressRuntime.localStorage = {
  value: JSON.stringify({
    version: 2,
    adventure: { levels: { '1-1': { stars: 4, best: 123 } }, unlockedWorld: 1, unlockedLevel: 2 },
    classic: { levels: { 'classic-1': { stars: 2, best: 55 } } }
  }),
  getItem() { return this.value; },
  setItem(key, value) { this.value = value; }
};
const progress = progressRuntime.Progress;
const persisted = vm.runInContext('new Progress()', progressRuntime);
assert(persisted, 'Progress should load in the VM runtime');
assert.strictEqual(persisted.getStars('adventure', '1-1'), 4,
  'new mode fields must preserve existing v2 campaign progress');
const run = persisted.beginHardcoreRun();
run.levels = 1;
run.world = 1;
run.level = 2;
run.score = 500;
run.stars = 5;
persisted.saveHardcoreCheckpoint(run);
const resumedProgress = vm.runInContext('new Progress()', progressRuntime);
assert.strictEqual(resumedProgress.data.hardcore.currentRun.level, 2,
  'Hardcore should resume at the next level after a checkpoint');
resumedProgress.finishHardcoreRun(run);
assert.strictEqual(resumedProgress.data.hardcore.history.length, 1,
  'Hardcore run history should persist');
persisted.addInfiniteScore({ seed, depth: 7, score: 900, stars: 22, date: '2026-01-01' });
assert.strictEqual(persisted.getLeaderboard(seed).length, 1,
  'Infinite leaderboard should be available per seed');

const corruptRuntime = loadRuntime();
corruptRuntime.localStorage = { getItem() { return '{bad json'; }, setItem() {} };
const corruptProgress = vm.runInContext('new Progress()', corruptRuntime);
assert.strictEqual(corruptProgress.data.version, 2,
  'corrupt localStorage should fall back to a valid v2 save');
const blockedRuntime = loadRuntime();
blockedRuntime.localStorage = {
  getItem() { throw new Error('storage blocked'); },
  setItem() { throw new Error('storage blocked'); }
};
const blockedProgress = vm.runInContext('new Progress()', blockedRuntime);
assert.doesNotThrow(() => blockedProgress.beginHardcoreRun(),
  'blocked localStorage should not prevent a run from starting');
assert.strictEqual(vm.runInContext("parseSeed32('0xFFFFFFFF')", blockedRuntime), 4294967295,
  'hexadecimal 32-bit seeds should parse');

for (let i = 0; i < 12; i++) {
  const extraRun = resumedProgress.beginHardcoreRun();
  extraRun.levels = 2 + (i % 3);
  extraRun.world = 1;
  extraRun.level = 3;
  extraRun.score = 100 + i * 10;
  extraRun.stars = extraRun.levels * 4;
  resumedProgress.finishHardcoreRun(extraRun);
}
assert.strictEqual(resumedProgress.data.hardcore.history.length, 10,
  'Hardcore must keep only the ten most recent runs');
assert.strictEqual(resumedProgress.data.hardcore.currentRun, null,
  'finishing a Hardcore run must clear the checkpoint');
assert.strictEqual(resumedProgress.data.hardcore.bestRun.levels, 4,
  'Hardcore must persist the best run by levels reached');

const dirtyInfiniteRuntime = loadRuntime();
dirtyInfiniteRuntime.localStorage = {
  value: JSON.stringify({
    version: 2,
    infinite: {
      bestDepth: -3,
      leaderboard: 'not-an-array',
      bySeed: {
        bad: [{ seed: 1, depth: 2 }],
        7: [
          { seed: 7, depth: '9', score: '10', stars: -1, date: 5 },
          { seed: 8, depth: 3, score: 100 }
        ]
      },
      currentRun: { seed: -1, depth: -2, score: 10, stars: 2, reserve: 999 }
    }
  }),
  getItem() { return this.value; },
  setItem(key, value) { this.value = value; }
};
const dirtyInfinite = vm.runInContext('new Progress()', dirtyInfiniteRuntime);
assert.strictEqual(dirtyInfinite.data.infinite.leaderboard.length, 0,
  'a corrupt Infinite leaderboard must fall back to an empty list');
assert.strictEqual(dirtyInfinite.data.infinite.bestDepth, 0,
  'a negative Infinite best depth must be clamped');
assert.strictEqual(dirtyInfinite.data.infinite.bySeed['7'].length, 1,
  'per-seed Infinite entries must match their seed key');
assert.strictEqual(dirtyInfinite.data.infinite.bySeed['7'][0].depth, 9,
  'per-seed Infinite entries must sanitize numeric fields');
assert.strictEqual(dirtyInfinite.data.infinite.bySeed.bad, undefined,
  'non-numeric Infinite seed buckets must be ignored');
assert.strictEqual(dirtyInfinite.data.infinite.currentRun.seed, 0,
  'Infinite run seeds must be clamped to 32 bits');
assert.strictEqual(dirtyInfinite.data.infinite.currentRun.depth, 1,
  'Infinite run depth must be at least one');
assert.strictEqual(dirtyInfinite.data.infinite.currentRun.reserve, 5,
  'Infinite reserve shots must never exceed the cap');

console.log('Tests passed: campaign, deterministic simulation, infinite difficulty progression, ' +
  '150 definitions, single-reactor objectives, special projectile effects, mutators and persistence.');
