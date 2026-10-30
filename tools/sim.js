#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const Matter = require('../lib/matter.min.js');

const ROOT = path.resolve(__dirname, '..');
const GRACE_STEPS = 180;

function loadRuntime() {
  const sandbox = {
    console: { warn() {}, error: console.error, log() {} },
    Matter,
    window: { TEST_LEVELS: {} },
    setTimeout,
  };
  vm.createContext(sandbox);

  const load = (relative) => {
    const filename = path.join(ROOT, relative);
    vm.runInContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
  };
  [
    'js/config.js',
    'js/rng.js',
    'js/themes.js',
    'js/fields.js',
    'js/fields-advanced.js',
    'js/levels.js',
    'js/templates.js',
    'js/campaign.js',
    'js/progress.js',
    'js/game.js',
    'js/core.js',
    'js/generator.js'
  ].forEach(load);
  return sandbox;
}

const runtime = loadRuntime();
const sharedSimulate = vm.runInContext('simulateLevel', runtime);
const SimulationJob = vm.runInContext('SimulationJob', runtime);
const CAMPAIGN_LEVELS = vm.runInContext('CAMPAIGN_LEVELS', runtime);

function simulate(levelDef, shot, options = {}) {
  return sharedSimulate(levelDef, shot, options);
}

function ammoCandidates(level) {
  return Array.from(new Set(level.ammo || ['normal']));
}

function searchLevel(level, options = {}) {
  const defaultAngles = [];
  for (let angle = 5; angle <= 85.0001; angle += 1.5) defaultAngles.push(Number(angle.toFixed(1)));
  const angles = options.angles || defaultAngles;
  const powers = options.powers || Array.from({ length: 8 }, (_, i) => 0.4 + i * (0.6 / 7));
  const candidates = [];
  let winningFirstShots = 0;
  let candidatesTested = 0;
  const types = ammoCandidates(level);

  for (const ammoType of types) {
    for (const angle of angles) {
      for (const power of powers) {
        const result = simulate(level, { angle, power, ammoType }, { skipGrace: true });
        candidatesTested++;
        candidates.push({ angle, power, ammoType, result, progress: objectiveProgressForResult(result) });
        if (result.won && result.shotsUsed === 1) winningFirstShots++;
      }
    }
  }
  candidates.sort((a, b) =>
    Number(b.result.won) - Number(a.result.won) ||
    a.result.shotsUsed - b.result.shotsUsed ||
    b.progress - a.progress ||
    a.result.steps - b.result.steps
  );
  const best = candidates[0];
  let solution = candidates.find((item) => item.result.won);
  let sequence = solution ? [] : [{
    stepDelay: 0,
    action: { angle: best.angle, power: best.power, ammoType: best.ammoType }
  }];

  while (!solution && sequence.length < level.shots) {
    const remainingTypes = ammoCandidates(level).filter((type) => {
      const quantity = (level.ammo || []).filter((item) => item === type).length;
      return quantity > sequence.filter((item => item.action.ammoType === type)).length;
    });
    const nextCandidates = [];
    for (const ammoType of remainingTypes) {
      for (const angle of angles) {
        for (const power of powers) {
          const extras = sequence.concat({
            stepDelay: 0,
            action: { angle, power, ammoType }
          });
          const first = sequence[0].action;
          const result = simulate(
            level,
            Object.assign({}, first, { extra: extras.slice(1) }),
            { skipGrace: true }
          );
          candidatesTested++;
          nextCandidates.push({
            angle,
            power,
            ammoType,
            result,
            progress: objectiveProgressForResult(result),
            extras
          });
          if (result.won) {
            solution = { result, extras };
            break;
          }
        }
        if (solution) break;
      }
      if (solution) break;
    }
    if (solution) break;
    nextCandidates.sort((a, b) =>
      b.progress - a.progress || b.result.score - a.result.score ||
      a.result.steps - b.result.steps
    );
    if (!nextCandidates.length) break;
    sequence = nextCandidates[0].extras;
    sequence[sequence.length - 1].progress = nextCandidates[0].progress;
  }

  const fraction = candidates.length ? winningFirstShots / candidates.length : 0;
  const triviality = Math.min(1, fraction / 0.25);
  const solvedShots = solution
    ? (solution.extras ? solution.extras.length : solution.result.shotsUsed)
    : null;
  return {
    solved: solvedShots !== null,
    minShots: solvedShots,
    solution: solution && solution.extras
      ? solution.extras.map((item) => item.action)
      : solution ? [{ angle: solution.angle, power: solution.power, ammoType: solution.ammoType }] : null,
    bestShot: best ? { angle: best.angle, power: best.power, ammoType: best.ammoType } : null,
    fractionOfGridThatWins: fraction,
    selfDestructInGrace: graceCheck(level),
    trivial: fraction > 0.25,
    triviality,
    candidatesTested
  };
}

function objectiveProgressForResult(result) {
  const last = result.log[result.log.length - 1];
  return last && Number(last.progress) || 0;
}

const graceCache = new Map();
function graceCheck(level) {
  if (!graceCache.has(level.id)) {
    const job = new SimulationJob(level, {
      angle: 45,
      power: 0.7,
      ammoType: (level.ammo || ['normal'])[0]
    }, { maxSteps: GRACE_STEPS, graceSteps: GRACE_STEPS });
    job.step(GRACE_STEPS);
    graceCache.set(level.id, job.selfDestruct);
  }
  return graceCache.get(level.id);
}

function getLevels() {
  return Array.from(CAMPAIGN_LEVELS);
}

function severity(report) {
  if (!report.solved || report.selfDestructInGrace) return 'ROJO';
  if (report.trivial || report.parStatus !== 'OK') return 'AMARILLO';
  return 'OK';
}

function validateLevel(level, options) {
  const search = searchLevel(level, options);
  const proposedPar = search.minShots === null
    ? null
    : Math.max(level.shots - 2, Math.min(level.shots - 1, search.minShots));
  search.proposedPar = proposedPar;
  search.parStatus = proposedPar !== null &&
    proposedPar >= search.minShots && proposedPar <= level.shots ? 'OK' : 'INVALIDO';
  search.state = severity(search);
  return { level, report: search };
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/g, '\\|');
}

function renderReport(rows) {
  const lines = [
    '# Informe de validación automática de Aventura',
    '',
    `Generado: ${new Date().toISOString()}`,
    '',
    'Búsqueda del primer tiro: ángulos 5°–85° cada 1,5°, ocho potencias 40 %–100 % y cada tipo',
    'de munición declarado. La física y el flujo de colisión se ejecutan en `Game.update()` de',
    '`js/game.js` con Matter.js local. Si el primer tiro no gana, se intenta extenderlo con una',
    'búsqueda voraz de secuencias; los tiros mínimos encontrados no certifican un mínimo global.',
    '',
    '| ID | Resuelto | Tiros mín. encontrados | Par propuesto | Malla ganadora | Autodestrucción | Trivialidad | Estado |',
    '|---|---:|---:|---:|---:|---|---:|---|'
  ];
  for (const { level, report } of rows) {
    const percent = (report.fractionOfGridThatWins * 100).toFixed(2) + '%';
    lines.push(`| ${escapeMarkdown(level.id)} | ${report.solved ? 'Sí' : 'No'} | ` +
      `${report.minShots === null ? '—' : report.minShots} | ` +
      `${report.proposedPar === null ? '—' : report.proposedPar} | ${percent} | ` +
      `${report.selfDestructInGrace ? 'Sí' : 'No'} | ${report.triviality.toFixed(3)} | ${report.state} |`);
  }
  lines.push('', '## Problemas y propuestas', '');
  const issues = [];
  for (const { level, report } of rows) {
    if (!report.solved) issues.push(`- **ROJO ${level.id}:** no se encontró tiro ganador en la malla. ` +
      'Revisar alcance, accesibilidad geométrica y condiciones del objetivo.');
    if (report.selfDestructInGrace) issues.push(`- **ROJO ${level.id}:** cambia objetivos/piezas o ` +
      'gana durante la espera sin disparar. Separar el mecanismo ambiental de la condición de victoria.');
    if (report.trivial) issues.push(`- **AMARILLO ${level.id}:** ${report.fractionOfGridThatWins * 100}% ` +
      'de la malla gana en un tiro. Aumentar la precisión requerida o proteger los objetivos.');
    if (report.parStatus !== 'OK') issues.push(`- **AMARILLO ${level.id}:** el par propuesto no ` +
      'está entre los tiros mínimos encontrados y los tiros disponibles.');
  }
  lines.push(...(issues.length ? issues : ['Sin problemas detectados por las reglas automáticas.']));
  lines.push('', '## Soluciones de referencia', '',
    '| ID | Secuencia ganadora (ángulo / potencia / proyectil) |',
    '|---|---|');
  for (const { level, report } of rows) {
    const sequence = report.solution
      ? report.solution.map((shot, i) =>
        `${i + 1}. ${shot.angle}° / ${(shot.power * 100).toFixed(0)}% / ${shot.ammoType}`
      ).join('; ')
      : 'Sin solución encontrada';
    lines.push(`| ${level.id} | ${escapeMarkdown(sequence)} |`);
  }
  return lines.join('\n') + '\n';
}

function validateLevelsParallel(levels, options) {
  const workerCount = Math.min(4, Math.max(1, os.cpus().length), levels.length);
  const byId = new Map(levels.map((level) => [level.id, level]));

  return new Promise((resolve, reject) => {
    const workers = [];
    const rows = new Map();
    let nextIndex = 0;
    let failed = false;

    const stopWorkers = () => Promise.all(workers.map((worker) => worker.terminate()));
    const fail = (error) => {
      if (failed) return;
      failed = true;
      stopWorkers().finally(() => reject(error));
    };
    const dispatch = (worker) => {
      if (failed || nextIndex >= levels.length) return;
      worker.postMessage({ id: levels[nextIndex++].id, options });
    };

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(__filename);
      workers.push(worker);
      worker.on('message', (message) => {
        if (message.error) {
          fail(new Error(message.error));
          return;
        }
        const level = byId.get(message.id);
        rows.set(message.id, { level, report: message.report });
        process.stdout.write(`${message.id}: ${message.report.state}, ` +
          `${message.report.candidatesTested} shot tests, ` +
          `${message.report.minShots || 'unsolved'} shots\n`);

        if (rows.size === levels.length) {
          failed = true;
          stopWorkers().then(() => resolve(levels.map((item) => rows.get(item.id))));
        } else {
          dispatch(worker);
        }
      });
      worker.on('error', fail);
      worker.on('exit', (code) => {
        if (!failed) fail(new Error(`Simulation worker exited with code ${code}`));
      });
      dispatch(worker);
    }
  });
}

function parseArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--all') opts.all = true;
    else if (args[i] === '--level') opts.level = args[++i];
    else if (args[i] === '--quick') opts.quick = true;
    else if (args[i] === '--json') opts.json = true;
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  return opts;
}

async function main(args) {
  const opts = parseArgs(args);
  let levels = getLevels();
  if (opts.level) levels = levels.filter((item) => item.id === opts.level);
  if (!opts.level && !opts.all) throw new Error('Use --all or --level <world-level>');
  if (!levels.length) throw new Error(`No level found for ${opts.level}`);
  const grid = opts.quick ? {
    angles: Array.from({ length: 17 }, (_, i) => 5 + i * 5),
    powers: [0.4, 0.55, 0.7, 0.85, 1]
  } : {};
  const rows = opts.all
    ? await validateLevelsParallel(levels, grid)
    : levels.map((level) => validateLevel(level, grid));
  if (!opts.all) {
    for (const { level, report } of rows) {
      process.stdout.write(`${level.id}: ${report.state}, ` +
        `${report.candidatesTested} shot tests, ${report.minShots || 'unsolved'} shots\n`);
    }
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify(rows.map(({ level, report }) => ({
      id: level.id, ...report
    })), null, 2) + '\n');
  }
  if (opts.all && !opts.quick) {
    const reportPath = path.join(ROOT, 'docs', 'validacion.md');
    fs.writeFileSync(reportPath, renderReport(rows), 'utf8');
    process.stdout.write(`Wrote ${path.relative(ROOT, reportPath)}\n`);
  } else if (opts.all) {
    process.stdout.write('Quick scan complete; official report unchanged.\n');
  }
  return rows;
}

if (!isMainThread) {
  parentPort.on('message', ({ id, options }) => {
    try {
      const level = getLevels().find((item) => item.id === id);
      if (!level) throw new Error(`No level found for ${id}`);
      parentPort.postMessage({ id, report: validateLevel(level, options).report });
    } catch (error) {
      parentPort.postMessage({ error: error.stack || error.message });
    }
  });
} else if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  simulate,
  searchLevel,
  validateLevel,
  getLevels,
  loadRuntime,
  generate: vm.runInContext('generate', runtime),
  validateGenerated: vm.runInContext('validateGenerated', runtime),
  mutatorForRun: vm.runInContext('mutatorForRun', runtime)
};
