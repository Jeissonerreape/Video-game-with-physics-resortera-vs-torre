/* Generador determinista y validador headless del modo Infinito. */
const INFINITE_MUTATORS = [
  { id: 'low-gravity', label: 'Gravedad baja', gravityScale: 0.7 },
  { id: 'permanent-wind', label: 'Viento permanente' },
  { id: 'heavy-projectiles', label: 'Proyectiles +50 % masa', massMultiplier: 1.5 },
  { id: 'fragile-targets', label: 'Objetivos frágiles' },
  { id: 'limited-ammo', label: 'Munición limitada' }
];

const GENERATOR_FIELDS = [
  { id: 'wind', cost: 2 },
  { id: 'water', cost: 3 },
  { id: 'movers', cost: 2 },
  { id: 'well', cost: 3 },
  { id: 'magnet', cost: 2 },
  { id: 'thermal', cost: 2 }
];

function generatorClone(value) {
  return cloneLevelData(value);
}

function generatorRandInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function generatorShotsForTargets(targets) {
  return Math.max(3, Math.min(8, Math.ceil(Math.max(1, targets) * 1.3) + 1));
}

function generatorAmmoForShots(shots, depth) {
  const ammo = ['normal', 'heavy'];
  if (depth >= 6) ammo.push('bounce');
  if (depth >= 10) ammo.push('explosive');
  if (depth >= 11) ammo.push('split', 'rocket');
  return Array.from({ length: shots }, (_, shotIndex) =>
    ammo[Math.min(ammo.length - 1, Math.floor(shotIndex * ammo.length / shots))]
  );
}

function generatorFieldIds(fields) {
  if (!fields || typeof fields !== 'object') return [];
  const map = {
    wind: 'wind',
    water: 'water',
    movers: 'movers',
    wells: 'well',
    magnets: 'magnet',
    thermal: 'thermal'
  };
  return Object.keys(map)
    .filter((key) => fields[key])
    .map((key) => map[key]);
}

/**
 * Añade munición coherente con el campo y los materiales sin cambiar el
 * número de tiros ni el primer proyectil (la malla de validación usa ese
 * primer tipo). Solo sustituye huecos duplicados, así que nunca quita una
 * herramienta única como el cohete.
 */
function generatorApplyAmmoAffinity(def, world) {
  if (!def || !Array.isArray(def.ammo) || !def.ammo.length) return;
  const fields = def.fields || {};
  const preferred = [];
  if (fields.wind) preferred.push('bounce');
  if (fields.water) preferred.push('explosive', 'heavy');
  if (fields.thermal) preferred.push('explosive');
  if (fields.movers) preferred.push('bounce');
  if (fields.wells || fields.magnets) preferred.push('rocket', 'heavy');
  if (world && (world.materials.primary === 'stone' ||
      world.materials.primary === 'steel' ||
      world.materials.secondary === 'steel')) {
    preferred.push('heavy');
  }
  if (def.goal && def.goal.type === 'switch') preferred.push('bounce');

  const list = def.ammo.slice();
  for (const type of preferred) {
    if (list.includes(type)) continue;
    const counts = {};
    for (const item of list) counts[item] = (counts[item] || 0) + 1;
    let slot = -1;
    for (let i = list.length - 1; i >= 1; i--) {
      if (counts[list[i]] > 1) { slot = i; break; }
    }
    if (slot < 0) continue;
    counts[list[slot]]--;
    list[slot] = type;
  }
  def.ammo = list;
}

function generatorStructureCost(structure, world, targets, archetype) {
  const source = TEMPLATES.structure({ structure });
  let cost = Math.max(1, targets) + (archetype === 'reactor' ? 2 : 0);
  for (const body of source.bodies) {
    if (body.t === 'rope') cost += 1;
    else if (body.t === 'lever' || body.t === 'switch') cost += 2;
    else if (body.t === 'domino') cost += 2;
    else if (body.t === 'box' &&
        (body.mat === 'stone' || world.materials.primary === 'stone')) cost += 1;
  }
  return cost;
}

function generatorMaterialize(def, world, rng, effectiveSeed, index, structure) {
  const source = TEMPLATES.structure({ structure });
  const widthScale = 0.88 + rng() * 0.24;
  const heightScale = 0.86 + rng() * 0.24;
  const offsetX = generatorRandInt(rng, -75, 100);
  const materials = world.materials;

  const bodies = source.bodies.map((original) => {
    const body = generatorClone(original);
    if (Number.isFinite(body.x)) body.x = Math.round(950 + (body.x - 950) * widthScale + offsetX);
    if (Number.isFinite(body.y)) body.y = Math.round(650 + (body.y - 650) * heightScale);
    if (body.mat) {
      body.mat = body.mat === 'glass' || body.mat === 'ice'
        ? materials.accent
        : (body.mat === 'steel'
          ? (world.id >= 4 ? materials.secondary : materials.accent)
          : materials.primary);
    }
    return body;
  });
  const targetCount = bodies.filter((body) => body.t === 'target').length;
  const shots = generatorShotsForTargets(targetCount);
  const ammoList = generatorAmmoForShots(shots, index);

  def.id = `infinite-${effectiveSeed >>> 0}-${index}`;
  def.name = `Reto ${index} · ${structure}`;
  def.hint = 'La masa, el ángulo y el momento de impacto cambian cómo cede cada estructura.';
  def.shots = shots;
  def.par = Math.max(1, shots - 1);
  def.ammo = ammoList;
  def.goal = { type: 'destroyAll' };
  def.bodies = bodies;
  def.fields = null;
  def.hearts = [];
  def.structure = structure;
  def.seed = effectiveSeed >>> 0;
  def.targetCount = targetCount;
}

function generatorAddField(def, fieldId, rng, intensity) {
  const x = generatorRandInt(rng, 760, 1080);
  const y = generatorRandInt(rng, 310, 520);
  let added = {};
  if (fieldId === 'wind') {
    added = { wind: { fx: (rng() < 0.5 ? -1 : 1) * (0.35 + intensity * 0.16), gust: 0.1, period: 150 } };
  } else if (fieldId === 'water') {
    added = { water: { y: 610, density: CONFIG.FIELD_WATER_DENSITY, drag: 0.04, rise: 0, riseMax: 0 } };
  } else if (fieldId === 'movers') {
    added = { movers: [{ id: 'infinite-platform', x, y: 600, ax: 35 + intensity * 9, omega: 0.45 + intensity * 0.05, w: 150, h: 18 }] };
  } else if (fieldId === 'well') {
    added = { wells: [{ id: 'infinite-well', x, y, k: Math.min(60, 10 + intensity * 5), radius: 90 }] };
  } else if (fieldId === 'magnet') {
    added = { magnets: [{ id: 'infinite-magnet', x, y, strength: Math.min(48, 12 + intensity * 4), radius: 90 }] };
  } else if (fieldId === 'thermal') {
    added = { thermal: { ice: [{ x, y: 600, w: 130, h: 16, meltRate: 0.3 + intensity * 0.08 }] } };
  }
  def.fields = Object.assign({}, def.fields || {}, added);
}

function generatorApplyMutator(def, mutator) {
  if (!mutator) return;
  def.mutator = mutator.id;
  if (mutator.id === 'permanent-wind') {
    def.fields = generatorClone(def.fields || {});
    def.fields.wind = Object.assign({}, def.fields.wind || {}, { fx: 0.55, fy: 0, gust: 0 });
  } else if (mutator.id === 'limited-ammo' && def.shots > 3) {
    // Se descarta el primer proyectil (normalmente el más básico) para
    // conservar las herramientas avanzadas, incluido el cohete.
    def.shots--;
    def.ammo = (def.ammo || []).slice(1);
    while (def.ammo.length < def.shots) def.ammo.push('normal');
    def.ammo = def.ammo.slice(0, def.shots);
    def.par = Math.min(def.par, def.shots - 1);
  }
}

function generate(seedRun, index, attempt = 0) {
  const depth = Math.max(1, Math.trunc(Number(index)) || 1);
  const runSeed = Number(seedRun) >>> 0;
  const effectiveRunSeed = (runSeed + Math.max(0, Math.trunc(Number(attempt)) || 0)) >>> 0;
  const effectiveSeed = hash32(effectiveRunSeed, depth);
  const rng = mulberry32(effectiveSeed);
  const budget = Math.min(54, Math.max(6, 4 + 0.9 * depth));
  const challenge = Math.min(1, Math.max(0, (depth - 1) / 40));
  let intensity = Math.min(3.2, 1 + depth * 0.04);
  const worldOffset = runSeed % 5;
  const worldId = ((worldOffset + Math.floor((depth - 1) / 5)) % 5) + 1;
  const world = getCampaignWorld(worldId);
  const theme = world.tema;
  const boss = depth % 10 === 0;
  const targetCount = boss
    ? 1
    : generatorRandInt(rng, 1, Math.min(5, 1 + Math.floor(depth / 4)));
  const archetype = boss ? 'boss' : (rng() < 0.6 ? 'demolition' : 'reactor');
  const structures = Object.keys(STRUCTURES);
  const affordable = structures.filter((structure) => {
    if (generatorStructureCost(structure, world, targetCount, archetype) > budget + 1) {
      return false;
    }
    if (archetype !== 'demolition') return true;
    return TEMPLATES.structure({ structure }).bodies.some((body) => body.t === 'target');
  });
  let structure = 'stable';
  if (affordable.length) {
    const weighted = affordable.map((candidate) => ({
      candidate,
      weight: 1 + challenge * Math.max(
        0,
        generatorStructureCost(candidate, world, targetCount, archetype) - 4
      ) * 0.45
    }));
    const weightTotal = weighted.reduce((sum, item) => sum + item.weight, 0);
    let choice = rng() * weightTotal;
    for (const item of weighted) {
      choice -= item.weight;
      if (choice <= 0) {
        structure = item.candidate;
        break;
      }
    }
  }
  const cost = generatorStructureCost(structure, world, targetCount, archetype);
  const candidateFields = GENERATOR_FIELDS.filter((field) =>
    field.cost <= budget + 1 - cost
  );
  const selectedFields = [];
  let totalCost = cost;
  const maxFields = depth <= 5 ? 1 : (depth <= 15 ? 2 : (depth <= 30 ? 3 : 4));
  while (selectedFields.length < maxFields && candidateFields.length) {
    const pick = candidateFields.splice(Math.floor(rng() * candidateFields.length), 1)[0];
    if (totalCost + pick.cost <= budget + 1 &&
        (selectedFields.length || depth <= 5 || rng() < 0.78)) {
      selectedFields.push(pick);
      totalCost += pick.cost;
    }
  }
  const mutatorIndex = Math.floor((depth - 1) / 5);
  const mutatorSeed = hash32(runSeed, mutatorIndex + 0x51);
  const mutator = INFINITE_MUTATORS[mutatorSeed % INFINITE_MUTATORS.length];

  const def = {
    id: `infinite-${effectiveRunSeed}-${depth}`,
    name: `Reto ${depth}`,
    hint: 'Observa el material y el campo antes de elegir el impulso.',
    shots: 3,
    par: 2,
    ammo: ['normal', 'heavy', 'normal'],
    fields: null,
    bodies: [],
    goal: { type: 'destroyAll' },
    hearts: [],
    ready: true,
    theme,
    intensity,
    world: worldId
  };

  generatorMaterialize(def, world, rng, effectiveRunSeed, depth, structure);
  const actualTargets = def.bodies.filter((body) => body.t === 'target').length;
  if (targetCount < actualTargets) {
    const seen = { value: 0 };
    def.bodies = def.bodies.filter((body) => body.t !== 'target' || ++seen.value <= targetCount);
  }
  def.targetCount = def.bodies.filter((body) => body.t === 'target').length;
  if (archetype !== 'reactor') {
    const objectiveTargets = def.bodies.filter((body) => body.t === 'target').length;
    if (objectiveTargets > 0) {
      def.targetCount = objectiveTargets;
      const shots = generatorShotsForTargets(objectiveTargets);
      if (shots !== def.shots || !Array.isArray(def.ammo) || def.ammo.length !== shots) {
        def.shots = shots;
        def.ammo = generatorAmmoForShots(shots, depth);
        def.par = Math.max(1, shots - 1);
      }
    }
  }
  for (const field of selectedFields) generatorAddField(def, field.id, rng, intensity);

  if (archetype === 'reactor') {
    const existingReactors = def.bodies.filter((body) => body.t === 'switch');
    if (existingReactors.length) {
      const reactor = existingReactors[0];
      def.bodies = def.bodies.filter((body) => body.t !== 'switch' || body === reactor);
    } else {
      const reactorX = generatorRandInt(rng, 820, 1100);
      const reactorY = def.fields && def.fields.water
        ? generatorRandInt(rng, 500, 550)
        : generatorRandInt(rng, 570, 620);
      def.bodies.push({ t: 'switch', id: 'infinite-reactor', x: reactorX, y: reactorY, r: 27 });
    }
    def.goal = { type: 'switch' };
    def.hint = 'Activa el único reactor; usa la estructura y la munición disponible a tu favor.';
    def.reactorCount = 1;
  }

  if (boss) {
    // Los jefes reutilizan la arena del campamento, ya calibrada para la
    // intensidad de su mundo. Escalarla con la profundidad los volvía
    // imposibles (por ejemplo, el agua del mundo 3 a 2.4x).
    if (Number.isFinite(world.intensidad)) intensity = world.intensidad;
    const bossDef = generatorClone(world.jefe);
    const campaignBoss = getCampaignLevel(worldId, 12);
    def.boss = Object.assign({}, bossDef, {
      hp: 3,
      r: bossDef.r || 38,
      slots: generatorClone(bossDef.slots || [[1040, 500], [930, 420], [1090, 500]]),
      hitEffects: generatorClone(bossDef.hitEffects || [])
    });
    def.goal = { type: 'boss' };
    def.bodies = generatorClone((campaignBoss && campaignBoss.bodies) || def.bodies);
    def.fields = generatorClone((campaignBoss && campaignBoss.fields) || def.fields);
    def.shots = 6;
    def.ammo = ['normal', 'heavy', 'bounce', 'explosive', 'split', 'rocket'];
    def.name = `Guardián de ${world.nombre}`;
    def.hint = `El jefe de ${world.nombre} cambia con cada impacto.`;
    def.targetCount = 1;
  }

  generatorApplyMutator(def, mutator);
  generatorApplyAmmoAffinity(def, world);
  const meta = {
    budget,
    spent: totalCost,
    archetype,
    fields: generatorFieldIds(def.fields),
    theme,
    world: worldId,
    intensity,
    challenge,
    targetCount: def.targetCount,
    seed: effectiveSeed >>> 0,
    mutator
  };
  return { def, meta };
}

function infiniteValidationGrid() {
  const angles = Array.from({ length: 24 }, (_, i) => 8 + i * (74 / 23));
  const powers = [0.4, 0.6, 0.8, 1];
  return { angles, powers };
}

function generatorYield() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

function generatorStepBudget() {
  return typeof requestAnimationFrame === 'function' ? 30 : 512;
}

function generatorSimulationOptions(generated, extra = {}) {
  const mutator = generated.meta.mutator;
  return Object.assign({
    mode: 'infinite',
    theme: generated.meta.theme,
    intensity: generated.meta.intensity,
    gravityScale: mutator && mutator.gravityScale,
    massMultiplier: mutator && mutator.massMultiplier,
    mutator: mutator && mutator.id
  }, extra);
}

function generatorSequenceProgress(result) {
  const log = result && Array.isArray(result.log) ? result.log : [];
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i] && log[i].event === 'shot-result') {
      return Number(log[i].progress) || 0;
    }
  }
  return 0;
}

async function generatorSimulateSequence(generated, sequence, budget) {
  if (!budget || budget.left <= 0) return null;
  budget.left--;
  const first = sequence[0];
  const shot = {
    angle: first.angle,
    power: first.power,
    ammoType: first.ammoType,
    extra: sequence.slice(1).map((item) => ({
      stepDelay: 0,
      action: { angle: item.angle, power: item.power, ammoType: item.ammoType }
    }))
  };
  const job = new SimulationJob(
    generated.def,
    shot,
    generatorSimulationOptions(generated, { skipGrace: true })
  );
  while (!job.done) {
    job.step(generatorStepBudget());
    if (!job.done) await generatorYield();
  }
  return job;
}

/**
 * Los jefes se teletransportan tras cada impacto, así que repetir el mismo
 * ángulo siempre termina fallando. Se buscan secuencias cortas variando
 * ángulo, potencia y munición, con un presupuesto acotado de simulaciones.
 */
async function generatorSolveBoss(generated, grid) {
  const def = generated.def;
  const shots = Math.max(1, Math.trunc(Number(def.shots)) || 1);
  const counts = {};
  for (const type of def.ammo || ['normal']) {
    const key = String(type || 'normal');
    counts[key] = (counts[key] || 0) + 1;
  }
  const order = ['normal', 'explosive', 'bounce', 'rocket', 'heavy', 'split']
    .filter((type) => counts[type]);
  const startTypes = order.filter((type) => type !== 'heavy' && type !== 'split');
  const powers = [1, 0.8, 0.6, 0.4];
  const budget = { left: 900, limit: 900 };
  const maxProgress = Math.max(1, Number(def.boss && def.boss.hp) || 3) * 100;
  const remaining = (sequence) => {
    const used = {};
    for (const item of sequence) {
      used[item.ammoType] = (used[item.ammoType] || 0) + 1;
    }
    return order.filter((type) => (used[type] || 0) < counts[type]);
  };
  const tests = () => budget.limit - budget.left;
  const starts = [];
  for (const type of (startTypes.length ? startTypes : order)) {
    let found = 0;
    for (const angle of grid.angles) {
      for (const power of powers) {
        const job = await generatorSimulateSequence(
          generated,
          [{ angle, power, ammoType: type }],
          budget
        );
        if (!job) return null;
        if (job.result.won) {
          return { sequence: [{ angle, power, ammoType: type }], tests: tests() };
        }
        const progress = generatorSequenceProgress(job.result);
        if (progress > 0) {
          starts.push({ angle, power, ammoType: type, progress, score: job.result.score });
          found++;
          if (found >= 2) break;
        }
      }
      if (found >= 2) break;
    }
    if (starts.length >= 10) break;
  }
  starts.sort((a, b) => b.progress - a.progress || b.score - a.score);
  for (const start of starts.slice(0, 3)) {
    let sequence = [{ angle: start.angle, power: start.power, ammoType: start.ammoType }];
    let progress = start.progress;
    while (sequence.length < shots) {
      const available = remaining(sequence);
      if (!available.length) break;
      const previous = sequence[sequence.length - 1].angle;
      const angles = grid.angles.slice().sort((a, b) =>
        Math.abs(a - previous) - Math.abs(b - previous)
      );
      let next = null;
      for (const power of powers) {
        for (const angle of angles) {
          for (const ammoType of available) {
            const job = await generatorSimulateSequence(
              generated,
              sequence.concat({ angle, power, ammoType }),
              budget
            );
            if (!job) return null;
            if (job.result.won) {
              return {
                sequence: sequence.concat({ angle, power, ammoType }),
                tests: tests()
              };
            }
            const reached = generatorSequenceProgress(job.result);
            if (reached > progress) {
              next = { angle, power, ammoType, progress: reached };
              break;
            }
          }
          if (next) break;
        }
        if (next) break;
      }
      if (!next) break;
      sequence = sequence.concat({
        angle: next.angle,
        power: next.power,
        ammoType: next.ammoType
      });
      progress = next.progress;
      if (progress >= maxProgress) {
        return { sequence, tests: tests() };
      }
    }
  }
  return null;
}

async function validateGenerated(seed, index, options = {}) {
  const attempts = Math.max(1, Math.min(12, options.attempts || CONFIG.INFINITE_VALIDATION_ATTEMPTS));
  const grid = options.grid || infiniteValidationGrid();
  for (let attempt = 0; attempt < attempts; attempt++) {
    const generated = generate(seed, index, attempt);
    const grace = new SimulationJob(generated.def, {
      angle: 45, power: 0.7, ammoType: generated.def.ammo[0]
    }, generatorSimulationOptions(generated, { graceSteps: 180, maxSteps: 180 }));
    while (!grace.done) {
      grace.step(generatorStepBudget());
      if (!grace.done) await generatorYield();
    }
    if (grace.selfDestruct) continue;

    if (generated.def.goal && generated.def.goal.type === 'boss') {
      const boss = await generatorSolveBoss(generated, grid);
      if (boss) {
        generated.def.par = Math.max(
          generated.def.shots - 2,
          Math.min(generated.def.shots - 1, boss.sequence.length)
        );
        generated.meta.validation = {
          solved: true,
          selfDestruct: false,
          fraction: 0,
          best: {
            angle: boss.sequence[0].angle,
            power: boss.sequence[0].power,
            ammoType: boss.sequence[0].ammoType,
            shotsUsed: boss.sequence.length,
            sequence: boss.sequence
          },
          boss: true,
          tests: boss.tests
        };
        return generated;
      }
      // Los intentos de un jefe son idénticos: no tiene sentido repetirlos.
      break;
    }

    let wins = 0;
    let best = null;
    let sequenceBest = null;
    let tested = 0;
    for (const angle of grid.angles) {
      for (const power of grid.powers) {
        const job = new SimulationJob(generated.def, {
          angle, power, ammoType: generated.def.ammo[0]
        }, generatorSimulationOptions(generated, { skipGrace: true }));
        while (!job.done) {
          job.step(generatorStepBudget());
          if (!job.done) await generatorYield();
        }
        tested++;
        const result = job.result;
        if (result.won && result.shotsUsed === 1) wins++;
        if (!best || result.won && !best.won ||
            result.won === best.won && result.score > best.score) {
          best = { won: result.won, score: result.score, angle, power, steps: result.steps };
        }
      }
    }
    const fraction = tested ? wins / tested : 0;
    if (!best || !best.won || best.steps === 0) {
      const sequenceAngles = grid.angles.filter((_, i) => i % 2 === 0);
      const sequencePowers = [0.6, 1].filter((power) => grid.powers.includes(power));
      for (const angle of sequenceAngles) {
        for (const power of sequencePowers) {
          const firstAmmo = generated.def.ammo[0] || 'normal';
          const shot = {
            angle,
            power,
            ammoType: firstAmmo,
            extra: generated.def.ammo.slice(1).map((ammoType) => ({
              stepDelay: 0,
              action: { angle, power, ammoType }
            }))
          };
          const job = new SimulationJob(
            generated.def,
            shot,
            generatorSimulationOptions(generated, { skipGrace: true })
          );
          while (!job.done) {
            job.step(generatorStepBudget());
            if (!job.done) await generatorYield();
          }
          if (job.result.won && (!sequenceBest ||
              job.result.shotsUsed < sequenceBest.shotsUsed ||
              (job.result.shotsUsed === sequenceBest.shotsUsed &&
                job.result.score > sequenceBest.score))) {
            sequenceBest = {
              angle, power, shotsUsed: job.result.shotsUsed, score: job.result.score
            };
          }
        }
      }
    }
    if ((best && best.won || sequenceBest) && fraction <= 0.25) {
      generated.def.par = Math.max(
        generated.def.shots - 2,
        Math.min(generated.def.shots - 1, sequenceBest ? sequenceBest.shotsUsed : 1)
      );
      generated.meta.validation = {
        solved: true,
        selfDestruct: false,
        fraction,
        best: sequenceBest || best
      };
      return generated;
    }
    if (options.onAttempt) options.onAttempt({ attempt: attempt + 1, fraction, best });
  }

  const fallback = generate(seed, index, attempts);
  fallback.def = generatorClone(STRUCTURES.stable);
  fallback.def.id = `infinite-${seed >>> 0}-${index}-fallback`;
  fallback.def.name = `Respaldo · Reto ${index}`;
  fallback.def.hint = 'Nivel de respaldo estable: usa un impacto preciso sobre la estructura.';
  fallback.def.ready = true;
  fallback.def.theme = fallback.meta.theme;
  fallback.def.intensity = fallback.meta.intensity;
  fallback.def.world = fallback.meta.world;
  fallback.def.fields = null;
  const bossFallback = index % 10 === 0;
  fallback.def.shots = bossFallback ? 6 : Math.max(3, fallback.def.shots || 3);
  fallback.def.ammo = bossFallback
    ? ['normal', 'heavy', 'bounce', 'explosive', 'split', 'rocket']
    : Array(fallback.def.shots).fill('normal');
  fallback.def.par = Math.max(1, fallback.def.shots - 1);
  if (bossFallback) {
    const world = getCampaignWorld(fallback.meta.world);
    const boss = {
      hp: 3,
      r: 28,
      color: world.jefe.color || getTheme(fallback.meta.theme).palette.accent,
      slots: Array.from({ length: 6 }, () => [950, 500]),
      obstacles: [],
      hitEffects: []
    };
    fallback.def.goal = { type: 'boss' };
    fallback.def.boss = boss;
    if (fallback.meta.world === 2) {
      fallback.def.fields = { wind: { fx: 0.45, gust: 0.08, period: 160 } };
      boss.hitEffects = [
        { wind: { fx: -0.75, fy: 0.1 } },
        { wind: { fx: 0.9, fy: -0.06 } }
      ];
    } else if (fallback.meta.world === 3) {
      fallback.def.fields = { water: { y: 635, density: 0.004, drag: 0.04, rise: 0, riseMax: 80 } };
      boss.hitEffects = [{ waterRise: 18 }, { waterRise: 24 }];
    } else if (fallback.meta.world === 4) {
      fallback.def.fields = {
        movers: [{ id: 'fallback-boss-platform', x: 950, y: 600, ax: 22, omega: 0.2, w: 180, h: 18, mat: 'steel' }]
      };
      boss.motion = { type: 'platform', moverId: 'fallback-boss-platform', offsetY: -100 };
      boss.hitEffects = [
        { mover: { id: 'fallback-boss-platform', omega: 0.36 } },
        { mover: { id: 'fallback-boss-platform', omega: 0.52 } }
      ];
    } else if (fallback.meta.world === 5) {
      fallback.def.fields = { wells: [{ id: 'fallback-boss-well', x: 950, y: 500, k: 8, radius: 120 }] };
      boss.motion = { type: 'orbit', x: 950, y: 500, radius: 24, omega: 0.32, phase: 0, acceleration: 0.12 };
    }
    fallback.def.name = `Guardián de respaldo · ${index}`;
    fallback.def.hint = 'El jefe conserva sus tres golpes y altera el campo de la arena.';
  }
  generatorApplyMutator(fallback.def, fallback.meta.mutator);
  generatorApplyAmmoAffinity(fallback.def, getCampaignWorld(fallback.meta.world));
  fallback.meta.fields = generatorFieldIds(fallback.def.fields);
  let fallbackWins = 0;
  let fallbackShot = null;
  const fallbackGrid = infiniteValidationGrid();
  const validationAngles = bossFallback
    ? fallbackGrid.angles
    : fallbackGrid.angles;
  const validationPowers = bossFallback ? [0.6, 0.8, 1] : fallbackGrid.powers;
  for (const angle of validationAngles) {
    for (const power of validationPowers) {
      const shot = {
        angle,
        power,
        ammoType: fallback.def.ammo[0],
        extra: bossFallback
          ? fallback.def.ammo.slice(1).map((ammoType) => ({
            stepDelay: 0, action: { angle, power, ammoType }
          }))
          : []
      };
      const job = new SimulationJob(
        fallback.def,
        shot,
        generatorSimulationOptions(fallback, { skipGrace: true })
      );
      while (!job.done) {
        job.step(generatorStepBudget());
        if (!job.done) await generatorYield();
      }
      if (job.result.won) {
        fallbackWins++;
        fallbackShot = fallbackShot || { angle, power };
      }
    }
  }
  const fallbackGridSize = validationAngles.length * validationPowers.length;
  if (!fallbackShot || (!bossFallback && fallbackWins / fallbackGridSize > 0.25)) {
    throw new Error(
      'La plantilla de respaldo no superó la validación de seguridad ' +
      `(${fallbackWins}/${fallbackGridSize} tiros ganadores).`
    );
  }
  fallback.meta.validation = {
    solved: true,
    selfDestruct: false,
    fraction: bossFallback ? 0 : fallbackWins / fallbackGridSize,
    fallback: true,
    best: fallbackShot
  };
  return fallback;
}

function mutatorForRun(seed, depth) {
  const segment = Math.floor((Math.max(1, depth) - 1) / 5);
  return INFINITE_MUTATORS[hash32(seed, segment + 0x51) % INFINITE_MUTATORS.length];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generate, validateGenerated, mutatorForRun, INFINITE_MUTATORS };
}
