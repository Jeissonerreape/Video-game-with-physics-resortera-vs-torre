/* =====================================================================
   Resortera vs. Torre — ESTRUCTURAS Y PLANTILLAS
   Las seis estructuras clásicas se comparten, no se duplican.
   ===================================================================== */

function cloneLevelData(value) {
  if (Array.isArray(value)) return value.map(cloneLevelData);
  if (!value || typeof value !== 'object') return value;
  const copy = {};
  for (const key of Object.keys(value)) copy[key] = cloneLevelData(value[key]);
  return copy;
}

const STRUCTURES = {
  stable: LEVELS[0],
  doubleTower: LEVELS[1],
  fortress: LEVELS[2],
  hanging: LEVELS[3],
  catapult: LEVELS[4],
  domino: LEVELS[5]
};

const TEMPLATES = {
  structure(params) {
    const source = STRUCTURES[params.structure];
    return source ? cloneLevelData(source) : this.construction(params);
  },

  definition(params) {
    return cloneLevelData(params.definition || this.construction(params));
  },

  construction(params, world) {
    return {
      name: params.nombre || params.name || 'En construcción',
      hint: params.concepto || 'Este nivel se completará en una fase posterior.',
      shots: Math.max(1, Number(params.shots) || 4),
      par: Math.max(1, Number(params.par) || 3),
      goal: { type: 'destroyAll' },
      bodies: [
        { t: 'target', x: 920, y: 620 },
        { t: 'box', mat: 'wood', x: 920, y: 648, w: 130, h: 18, isStatic: true }
      ],
      fields: cloneLevelData(params.fields || null),
      ready: false
    };
  },

  lesson(params, world) {
    const materials = world.materials;
    const primary = materials.primary;
    const secondary = materials.secondary;
    const accent = materials.accent;
    const seedOffset = ((Number(params.seed) || 0) % 5) * 12;
    const x = params.kind === 'water' ? 690 + seedOffset : 820 + seedOffset;
    const definition = {
      name: params.nombre,
      hint: params.concepto,
      shots: params.shots,
      par: params.par,
      ammo: cloneLevelData(params.ammo),
      goal: cloneLevelData(params.goal || { type: 'destroyAll' }),
      fields: cloneLevelData(params.fields || null),
      hearts: cloneLevelData(params.hearts || []),
      bodies: []
    };

    if (params.kind === 'wind' || params.kind === 'water' ||
        params.kind === 'well' || params.kind === 'demolition') {
      const staticForWater = params.kind === 'water';
      definition.bodies.push(
        { t: 'box', mat: primary, x: x - 38, y: 595, w: 22, h: 110, isStatic: staticForWater },
        { t: 'box', mat: secondary, x: x + 38, y: 595, w: 22, h: 110, isStatic: staticForWater },
        { t: 'box', mat: accent, x: x, y: 529, w: 112, h: 18, isStatic: staticForWater },
        { t: 'target', x: x, y: 500 },
        { t: 'target', x: x + 118, y: 633 }
      );
      if (params.kind === 'water') {
        definition.bodies.push(
          { t: 'box', mat: accent, x: 930, y: 620, w: 150, h: 16, isStatic: true },
          { t: 'target', x: 930, y: 585 }
        );
      }
      if (params.kind === 'demolition') {
        definition.bodies.push(
          { t: 'box', mat: secondary, x: x + 84, y: 570, w: 18, h: 150 },
          { t: 'target', x: x + 84, y: 475 }
        );
      }
    } else if (params.kind === 'movers') {
      definition.fields.movers[0].id = 'lesson-platform';
      const mover = definition.fields.movers[0];
      definition.bodies.push(
        { t: 'box', mat: primary, x: mover.x, y: mover.y - 48, w: 24, h: 84, mover: 'lesson-platform' },
        { t: 'target', x: mover.x, y: mover.y - 105, mover: 'lesson-platform' },
        { t: 'target', x: mover.x + 110, y: 633 }
      );
    } else if (params.kind === 'pulley') {
      definition.goal = { type: 'destroyAll' };
      definition.bodies.push(
        { t: 'target', x: 842, y: 603 },
        { t: 'target', x: 1100, y: 603 },
        { t: 'box', mat: secondary, x: 982, y: 580, w: 46, h: 48, isStatic: true }
      );
    } else if (params.kind === 'chain') {
      definition.bodies.push(
        { t: 'box', mat: secondary, x: 915, y: 640, w: 390, h: 20, isStatic: true },
        { t: 'box', mat: primary, x: 590, y: 580, w: 20, h: 140, isStatic: true },
        { t: 'switch', id: 'chain-reactor', x: 1080, y: 610, r: 28, requireChain: true },
        { t: 'target', x: 590, y: 493 }
      );
      for (let i = 0; i < 7; i++) {
        definition.bodies.push({
          t: 'domino',
          x: 760 + i * 45,
          y: 608,
          w: 14,
          h: 44
        });
      }
    } else if (params.kind === 'pendulum') {
      definition.bodies.push(
        { t: 'box', mat: primary, x: 850, y: 624, w: 250, h: 16, angle: -0.16, isStatic: true },
        { t: 'rope', x: 775, y: 210, length: 300, r: 24, mat: secondary },
        { t: 'target', x: 1010, y: 570 },
        { t: 'target', x: 1120, y: 633 }
      );
    } else if (params.kind === 'heart') {
      definition.hearts = [{ x: 700, y: 320, r: 22 }];
      definition.bodies.push(
        { t: 'box', mat: primary, x: 850, y: 590, w: 24, h: 120, isStatic: true },
        { t: 'box', mat: secondary, x: 980, y: 590, w: 24, h: 120, isStatic: true },
        { t: 'box', mat: accent, x: 915, y: 518, w: 170, h: 20, isStatic: true },
        { t: 'target', x: 875, y: 489 },
        { t: 'target', x: 955, y: 489 },
        { t: 'target', x: 1090, y: 633 }
      );
    } else if (params.kind === 'special') {
      if (params.special === 'inclines') {
        definition.bodies.push(
          { t: 'box', mat: primary, x: 790, y: 574, w: 230, h: 18, angle: -0.28, friction: 0.82, isStatic: true },
          { t: 'box', mat: accent, x: 1050, y: 574, w: 230, h: 18, angle: -0.28, friction: 0.12, isStatic: true },
          { t: 'wheel', mat: secondary, x: 780, y: 540, r: 24, hollow: false },
          { t: 'wheel', mat: secondary, x: 1030, y: 540, r: 24, hollow: true },
          { t: 'target', x: 1135, y: 633 }
        );
      } else if (params.special === 'laserCradle') {
        definition.goal = cloneLevelData(params.goal || { type: 'destroyAll' });
        definition.bodies.push(
          { t: 'switch', id: 'laser-reactor', x: 150, y: 250, r: 26, requireChain: true },
          { t: 'rope', x: 920, y: 430, length: 120, r: 17, mat: primary, restitution: 0.92 },
          { t: 'rope', x: 954, y: 430, length: 120, r: 17, mat: primary, restitution: 0.92 },
          { t: 'rope', x: 988, y: 430, length: 120, r: 17, mat: primary, restitution: 0.92 },
          { t: 'rope', x: 1022, y: 430, length: 120, r: 17, mat: primary, restitution: 0.08 },
          { t: 'target', x: 1090, y: 540 },
          { t: 'target', x: 1125, y: 633 }
        );
      } else if (params.special === 'thermalBlast') {
        definition.bodies.push(
          { t: 'switch', id: 'thermal-trigger', x: 790, y: 610, r: 26 },
          { t: 'box', mat: primary, x: 905, y: 500, w: 190, h: 20 },
          { t: 'target', x: 905, y: 470 },
          { t: 'target', x: 1035, y: 633 }
        );
      } else if (params.special === 'magnetCircuit') {
        definition.goal = {
          type: 'switch',
          groups: [
            { any: ['gate-a', 'gate-b'] },
            { all: ['gate-c'] }
          ]
        };
        definition.bodies.push(
          { t: 'switch', id: 'gate-a', x: 785, y: 610, r: 26, requireChain: true },
          { t: 'switch', id: 'gate-b', x: 920, y: 610, r: 26, requireChain: true },
          { t: 'switch', id: 'gate-c', x: 1080, y: 610, r: 26, requireChain: true },
          { t: 'box', mat: 'steel', x: 850, y: 535, w: 30, h: 70 },
          { t: 'box', mat: primary, x: 1010, y: 550, w: 36, h: 90 }
        );
        for (let i = 0; i < 11; i++) {
          definition.bodies.push({
            t: 'domino',
            x: 700 + i * 42,
            y: 608,
            w: 14,
            h: 44
          });
        }
      } else if (params.special === 'resonance') {
        definition.bodies.push(
          { t: 'target', x: 930, y: 535 },
          { t: 'target', x: 1040, y: 633 }
        );
      }
    } else if (params.kind === 'combo') {
      definition.goal = {
        type: 'switch',
        groups: [{ all: ['combo-a', 'combo-b'] }]
      };
      definition.bodies.push(
        { t: 'box', mat: secondary, x: 850, y: 440, w: 24, h: 190, isStatic: true },
        { t: 'switch', id: 'combo-a', x: 785, y: 610, r: 25, requireChain: true },
        { t: 'switch', id: 'combo-b', x: 1135, y: 610, r: 25, requireChain: true },
        { t: 'box', mat: secondary, x: 930, y: 640, w: 500, h: 20, isStatic: true },
        { t: 'lever', x: 930, y: 580, w: 250, h: 16, mat: 'wood', density: 0.0007 },
        { t: 'box', mat: secondary, x: 1045, y: 600, w: 20, h: 20, isStatic: true },
        { t: 'box', mat: primary, x: 1040, y: 558, w: 24, h: 24, density: 0.0012 },
        { t: 'rope', x: 800, y: 190, length: 260, r: 26, mat: secondary },
      );
      for (let i = 0; i < 11; i++) {
        definition.bodies.push({ t: 'domino', x: 700 + i * 42, y: 608, w: 14, h: 44 });
      }
    }

    return definition;
  },

  boss(params, world) {
    const boss = cloneLevelData(params.boss);
    boss.color = boss.color || getTheme(world.tema).palette.reactor;
    boss.name = boss.name || params.nombre;
    return {
      name: params.nombre,
      hint: params.concepto,
      shots: 6,
      par: 4,
      ammo: cloneLevelData(params.ammo),
      goal: { type: 'boss' },
      fields: cloneLevelData(params.fields || null),
      boss: boss,
      bodies: [
        { t: 'box', mat: world.materials.secondary, x: 760, y: 630, w: 120, h: 40, isStatic: true },
        { t: 'box', mat: world.materials.secondary, x: 1080, y: 630, w: 120, h: 40, isStatic: true }
      ]
    };
  }
};
