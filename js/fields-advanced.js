/* =====================================================================
   Resortera vs. Torre — CAMPOS AVANZADOS
   ---------------------------------------------------------------------
   Módulos de `Fields.registry` para la fase 1A ampliada:

     wells        pozos y repulsores gravitatorios
     gravityZones zonas de gravedad local
     movers       plataformas móviles
     pulleys      poleas con contrapeso (máquina de Atwood)
     magnets      imanes que atraen materia ferrosa
     lasers       láser con espejos y reactor objetivo
     thermal      fuegos, hielo que se derrite

   Todos se configuran con DATOS en `def.fields`. Ningún módulo conoce
   números de mundo. Los que crean cuerpos lo hacen solo si existe
   `state.game` y no estamos en la predicción (`state.predict`).
   ===================================================================== */

(function () {
  const registry = Fields.registry;

  function clampLocal(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Ruido determinista de presentación (nunca entra en la física). */
  function hash01(n) {
    const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function stepAccelToForce(body, accel) {
    const dtSq = CONFIG.STEP_MS * CONFIG.STEP_MS;
    return body.mass * accel / dtSq;
  }

  function gravityStep() {
    return 0.001 * CONFIG.GRAVITY * CONFIG.STEP_MS * CONFIG.STEP_MS;
  }

  function accelToMs2(accel) {
    return accel * 3600 / CONFIG.FIELD_PX_PER_METER;
  }

  function pushEvent(state, evt) {
    if (!state || state.predict) return;
    if (state.events) state.events.push(evt);
  }

  function addWorldBody(state, body, asBlock) {
    if (!state || !state.game || !body) return body;
    Matter.Composite.add(state.game.world, body);
    if (asBlock !== false && Array.isArray(state.game.blocks) &&
        state.game.blocks.indexOf(body) < 0) {
      state.game.blocks.push(body);
    }
    return body;
  }

  function addConstraint(state, constraint) {
    if (!state || !state.game || !constraint) return constraint;
    Matter.Composite.add(state.game.world, constraint);
    return constraint;
  }

  /** Crea una caja usando el mismo pipeline que los niveles. */
  function spawnBox(state, def) {
    if (!state || !state.game) return null;
    const body = state.game.makeBody(def);
    if (body) Matter.Composite.add(state.game.world, body);
    return body;
  }

  function switchBody(state, id) {
    const game = state && state.game;
    if (!game || !Array.isArray(game.switches) || id === undefined || id === null) return null;
    return game.switches.find((s) => s.game && String(s.game.id) === String(id)) || null;
  }

  function switchActive(state, id) {
    const body = switchBody(state, id);
    return !!(body && body.game && body.game.activated);
  }

  /* --------------------------- pozos -------------------------------- */

  const wells = {
    init(state) {
      state.wells = (state.items || []).map((w, i) => ({
        x: num(w.x, CONFIG.WIDTH / 2),
        y: num(w.y, CONFIG.HEIGHT / 2),
        k: Math.max(0, num(w.k, CONFIG.FIELD_WELL_K)),
        repel: !!w.repel,
        rmin: Math.max(1, num(w.rmin, CONFIG.FIELD_WELL_RMIN)),
        radius: Math.max(18, num(w.radius, CONFIG.FIELD_WELL_RADIUS)),
        id: w.id === undefined ? `well-${i}` : w.id
      }));
    },

    apply(state, bodies) {
      if (!state.wells || !state.wells.length) return;
      const wellsList = state.wells;

      for (const body of bodies) {
        if (!body || body.isStatic || body.isSensor) continue;
        if (!(body.mass > 0)) continue;

        for (const w of wellsList) {
          if (!(w.k > 0)) continue;
          const dx = w.x - body.position.x;
          const dy = w.y - body.position.y;
          const r = Math.max(Math.hypot(dx, dy), w.rmin);
          const f = (w.k * body.mass) / (r * r);
          const sign = w.repel ? -1 : 1;
          Matter.Body.applyForce(body, body.position, {
            x: sign * (dx / r) * f,
            y: sign * (dy / r) * f
          });
        }
      }
    },

    drawBack(state) {
      if (!state.wells) return;
      for (const w of state.wells) {
        const hot = w.repel ? [92, 214, 255] : [186, 126, 255];
        const deep = w.repel ? [12, 44, 66] : [22, 12, 34];

        push();
        translate(w.x, w.y);
        noStroke();

        // halo exterior
        for (let i = 4; i >= 1; i--) {
          fill(hot[0], hot[1], hot[2], 7 + i * 2);
          circle(0, 0, w.radius * 2 + i * 16);
        }

        // disco oscuro / lente
        fill(deep[0], deep[1], deep[2], 205);
        circle(0, 0, w.radius * 2);
        fill(hot[0], hot[1], hot[2], 22);
        circle(0, 0, w.radius * 1.45);

        // anillos concéntricos animados
        noFill();
        for (let i = 0; i < 4; i++) {
          const phase = (state.step * 0.012 + i * 0.25) % 1;
          stroke(hot[0], hot[1], hot[2], 110 * (1 - phase));
          strokeWeight(1.5);
          circle(0, 0, w.radius * (0.35 + phase * 1.55));
        }

        // lente: círculos desplazados simulan la refracción
        noStroke();
        fill(255, 255, 255, w.repel ? 20 : 12);
        circle(-w.radius * 0.22, -w.radius * 0.18, w.radius * 0.62);
        fill(255, 255, 255, 9);
        circle(w.radius * 0.2, w.radius * 0.24, w.radius * 0.86);
        fill(hot[0], hot[1], hot[2], 16);
        circle(-w.radius * 0.1, w.radius * 0.08, w.radius * 0.34);

        stroke(hot[0], hot[1], hot[2], 160);
        strokeWeight(2);
        noFill();
        circle(0, 0, w.radius * 2);

        // núcleo
        noStroke();
        fill(hot[0], hot[1], hot[2], 210);
        circle(0, 0, 10 + 3 * Math.sin(state.step * 0.08 + w.x));
        fill(255, 255, 255, 130);
        circle(-2, -2, 4);

        pop();
      }
    },

    draw(state) {
      if (!state.wells) return;
      for (const w of state.wells) {
        push();
        noStroke();
        for (let i = 0; i < 3; i++) {
          const a = state.step * 0.02 + i * 2.1 + hash01(w.x + i);
          const r = w.radius * (0.55 + 0.35 * hash01(i * 7 + w.y));
          fill(w.repel ? [150, 235, 255] : [220, 180, 255]);
          circle(
            w.x + Math.cos(a) * r,
            w.y + Math.sin(a) * r,
            2 + 2 * hash01(i * 11 + w.x)
          );
        }
        pop();
      }
    },

    overlay(state) {
      if (!state.wells || !state.wells.length) return;
      push();
      const cols = 12;
      const rows = 7;
      const x0 = 64;
      const y0 = 82;
      const dx = (CONFIG.WIDTH - 128) / (cols - 1);
      const dy = (CONFIG.GROUND_Y - 142) / (rows - 1);
      const dtSq = CONFIG.STEP_MS * CONFIG.STEP_MS;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = x0 + col * dx;
          const y = y0 + row * dy;
          let ax = 0;
          let ay = 0;

          for (const w of state.wells) {
            const vx = w.x - x;
            const vy = w.y - y;
            const r = Math.max(Math.hypot(vx, vy), w.rmin);
            const a = (w.k / (r * r)) * dtSq * (w.repel ? -1 : 1);
            ax += (vx / r) * a;
            ay += (vy / r) * a;
          }

          const mag = Math.hypot(ax, ay);
          if (mag < 0.006) continue;
          const len = clampLocal(mag * 44, 4, 44);
          const ux = ax / mag;
          const uy = ay / mag;
          stroke(210, 160, 255, 145);
          strokeWeight(1.4);
          line(x, y, x + ux * len, y + uy * len);
          noStroke();
          fill(230, 195, 255, 175);
          push();
          translate(x + ux * len, y + uy * len);
          rotate(Math.atan2(uy, ux));
          triangle(0, 0, -7, -3.5, -7, 3.5);
          pop();
        }
      }

      noStroke();
      fill('#e0c2ff');
      useText(11, true);
      textAlign(LEFT, BOTTOM);
      const first = state.wells[0];
      text(
        `CAMPO · ${state.wells.length} pozo(s) · k ${first.k.toFixed(0)} · rejilla 12×7`,
        64, CONFIG.GROUND_Y - 16
      );
      pop();
    }
  };

  /* ---------------------- zonas de gravedad ------------------------- */

  const gravityZones = {
    init(state) {
      const fallbackG = gravityStep();
      state.zones = (state.items || []).map((z) => ({
        x: num(z.x, CONFIG.WIDTH / 2),
        y: num(z.y, CONFIG.HEIGHT / 2),
        w: Math.max(10, num(z.w, 160)),
        h: Math.max(10, num(z.h, 120)),
        g: clampLocal(
          num(z.g, fallbackG),
          CONFIG.FIELD_ZONE_MIN_G,
          CONFIG.FIELD_ZONE_MAX_G
        )
      }));
    },

    inside(zone, body) {
      const p = body.position;
      return Math.abs(p.x - zone.x) <= zone.w / 2 &&
        Math.abs(p.y - zone.y) <= zone.h / 2;
    },

    apply(state, bodies) {
      if (!state.zones || !state.zones.length) return;
      const gGlobal = gravityStep();

      for (const body of bodies) {
        if (!body || body.isStatic || body.isSensor) continue;
        let accel = 0;
        for (const zone of state.zones) {
          if (this.inside(zone, body)) accel += zone.g - gGlobal;
        }
        if (Math.abs(accel) < 1e-6) continue;
        Matter.Body.applyForce(body, body.position, {
          x: 0,
          y: stepAccelToForce(body, accel)
        });
      }
    },

    drawBack(state) {
      if (!state.zones) return;
      const gGlobal = gravityStep();
      for (const zone of state.zones) {
        const low = zone.g < gGlobal - 1e-5;
        const high = zone.g > gGlobal + 1e-5;
        const tint = low ? [88, 196, 230] : (high ? [214, 120, 92] : [180, 180, 180]);

        push();
        const x = zone.x - zone.w / 2;
        const y = zone.y - zone.h / 2;
        noStroke();
        for (let i = 0; i < 14; i++) {
          const t = i / 13;
          fill(tint[0], tint[1], tint[2], 5 + t * 22);
          rect(x, y + t * zone.h, zone.w, zone.h / 13 + 1);
        }

        noFill();
        stroke(tint[0], tint[1], tint[2], 95);
        strokeWeight(1.5);
        rect(x, y, zone.w, zone.h, 6);

        // flechas hacia abajo: su tamaño refleja g
        stroke(tint[0], tint[1], tint[2], 105);
        strokeWeight(1.3);
        const arrowLen = 5 + zone.g * 13;
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 4; col++) {
            const ax = x + 20 + col * ((zone.w - 40) / 3);
            const ay = y + 20 + row * ((zone.h - 40) / 2);
            line(ax, ay, ax, ay + arrowLen);
            noStroke();
            fill(tint[0], tint[1], tint[2], 130);
            triangle(
              ax - 4, ay + arrowLen, ax + 4, ay + arrowLen,
              ax, ay + arrowLen + 6
            );
          }
        }

        // partículas que suben lento si la gravedad es baja
        if (low) {
          noStroke();
          for (let i = 0; i < 10; i++) {
            const px = x + 12 + hash01(i * 3 + zone.x) * (zone.w - 24);
            const travel = (state.step * 0.55 + i * 31) % zone.h;
            const py = y + zone.h - travel;
            const a = 30 + 90 * (travel / zone.h);
            fill(210, 245, 255, a);
            circle(px, py, 1.8 + hash01(i * 17 + 2) * 2.2);
          }
        }
        pop();
      }
    },

    draw(state) {
      // Reflejo tenue en el borde superior para dar volumen a la zona.
      if (!state.zones) return;
      const gGlobal = gravityStep();
      for (const zone of state.zones) {
        if (zone.g >= gGlobal - 1e-5) continue;
        push();
        noStroke();
        fill(200, 245, 255, 20);
        rect(
          zone.x - zone.w / 2, zone.y - zone.h / 2,
          zone.w, 3, 2
        );
        pop();
      }
    },

    overlay(state) {
      if (!state.zones) return;
      push();
      useText(10, true);
      textAlign(LEFT, TOP);
      for (const zone of state.zones) {
        const label = `${zone.g.toFixed(2)} px/paso² · ${accelToMs2(zone.g).toFixed(1)} m/s²`;
        const x = zone.x - zone.w / 2 + 6;
        const y = zone.y - zone.h / 2 + 6;
        noStroke();
        fill(8, 18, 26, 155);
        rect(x, y, Math.max(132, textWidth(label) + 12), 17, 4);
        fill(zone.g < gravityStep() ? '#bdefff' : '#ffd1b8');
        text(label, x + 6, y + 3);
      }
      pop();
    }
  };

  /* ---------------------- plataformas móviles ----------------------- */

  const movers = {
    init(state) {
      state.movers = (state.items || []).map((m, i) => ({
        id: m.id === undefined ? `mover-${i}` : m.id,
        x: num(m.x, CONFIG.WIDTH / 2),
        y: num(m.y, CONFIG.GROUND_Y - 100),
        ax: num(m.ax, 0),
        ay: num(m.ay, 0),
        omega: num(m.omega, 1),
        phase: num(m.phase, 0),
        w: Math.max(12, num(m.w, 160)),
        h: Math.max(8, num(m.h, 20)),
        mat: m.mat || 'stone',
        rides: [],
        body: null,
        prevX: 0,
        prevY: 0
      }));
      state.byId = {};
      for (const m of state.movers) state.byId[String(m.id)] = m;

      if (!state.game || state.predict) return;

      for (const m of state.movers) {
        const px = m.x + m.ax * Math.sin(m.phase);
        const py = m.y + m.ay * Math.sin(m.phase);
        const body = Matter.Bodies.rectangle(px, py, m.w, m.h, {
          isStatic: true,
          friction: CONFIG.FIELD_MOVER_FRICTION,
          frictionStatic: CONFIG.FIELD_MOVER_FRICTION,
          restitution: 0.01,
          label: 'mover'
        });
        body.game = {
          kind: 'mover',
          id: m.id,
          mat: m.mat,
          w: m.w,
          h: m.h,
          hp: 999999,
          maxHp: 999999,
          damageMult: 0,
          seed: Math.abs(Math.floor(m.x * 31 + m.y * 17)) % 100000,
          hurt: 0,
          dead: false,
          removed: false
        };
        m.body = body;
        m.prevX = px;
        m.prevY = py;
        addWorldBody(state, body, true);
      }
    },

    apply(state, bodies, step) {
      if (!state.movers) return;
      const t = step / 60;

      for (const m of state.movers) {
        if (!m.body || !m.body.game || m.body.game.removed) continue;
        const s = Math.sin(m.omega * t + m.phase);
        const c = Math.cos(m.omega * t + m.phase);
        const nx = m.x + m.ax * s;
        const ny = m.y + m.ay * s;
        const vx = (m.ax * m.omega * c) / 60;
        const vy = (m.ay * m.omega * c) / 60;

        Matter.Body.setPosition(m.body, { x: nx, y: ny });
        Matter.Body.setVelocity(m.body, { x: vx, y: vy });
        m.prevX = nx;
        m.prevY = ny;

        // Las cargas declaradas con `mover: id` siguen la plataforma.
        for (const ride of m.rides) {
          const rideBody = ride.body;
          if (!rideBody || !rideBody.game || rideBody.game.removed) continue;
          const tx = nx + ride.ox;
          const ty = ny + ride.oy;
          if (dist(rideBody.position.x, rideBody.position.y, tx, ty) > 70) {
            ride.detached = true;
            continue;
          }
          if (ride.detached) continue;
          Matter.Body.setPosition(rideBody, { x: tx, y: ty });
          Matter.Body.setVelocity(rideBody, { x: 0, y: 0 });
          ride.tx = tx;
          ride.ty = ty;
        }
      }
    },

    /**
     * Se llama justo después de Matter.Engine.update: las colisiones de la
     * carga con el objetivo pueden desplazar la pieza unos píxeles; aquí se
     * vuelve a fijar al carril para que no parezca que resbala.
     */
    afterUpdate(state) {
      if (!state.movers) return;
      for (const m of state.movers) {
        for (const ride of m.rides) {
          if (ride.detached) continue;
          const rideBody = ride.body;
          if (!rideBody || !rideBody.game || rideBody.game.removed) continue;
          Matter.Body.setPosition(rideBody, { x: ride.tx, y: ride.ty });
          Matter.Body.setVelocity(rideBody, { x: 0, y: 0 });
        }
      }
    },

    drawBack(state) {
      if (!state.movers) return;
      push();
      for (const m of state.movers) {
        const x0 = m.x - m.ax;
        const y0 = m.y - m.ay;
        const x1 = m.x + m.ax;
        const y1 = m.y + m.ay;

        stroke(20, 26, 32, 90);
        strokeWeight(9);
        line(x0, y0, x1, y1);
        stroke(180, 196, 210, 105);
        strokeWeight(2);
        line(x0, y0, x1, y1);

        // marcas de la trayectoria
        noStroke();
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          fill(220, 235, 245, 70);
          circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 2.4);
        }
      }
      pop();
    },

    draw(state) {
      if (!state.movers) return;
      const t = state.step / 60;
      push();
      for (const m of state.movers) {
        if (!m.body) continue;
        const phase = m.omega * t + m.phase;
        const body = m.body;
        noStroke();
        for (let i = 0; i < 3; i++) {
          const a = phase + i * (TWO_PI / 3);
          const x = body.position.x + Math.cos(a) * (m.w / 2 - 6);
          const y = body.position.y - m.h / 2 - 4;
          const glow = 0.5 + 0.5 * Math.sin(phase * 2 + i);
          fill(255, 218, 110, 40 + 90 * glow);
          circle(x, y, 4 + 2 * glow);
        }
      }
      pop();
    },

    overlay(state) {
      if (!state.movers) return;
      const t = state.step / 60;
      push();
      useText(9.5, true);
      textAlign(LEFT, BOTTOM);
      for (const m of state.movers) {
        if (!m.body) continue;
        const period = m.omega !== 0 ? Math.abs(TWO_PI / m.omega) : Infinity;
        const phase = m.omega * t + m.phase;
        const label = `x(t)=${m.ax.toFixed(0)}·sin(${m.omega.toFixed(2)}t+${m.phase.toFixed(2)})` +
          ` · T=${period.toFixed(2)}s · φ=${(phase % TWO_PI).toFixed(2)}rad`;
        noStroke();
        fill(8, 18, 26, 165);
        rect(m.body.position.x - 130, m.body.position.y - m.h / 2 - 28, 260, 18, 5);
        fill('#ffe6a8');
        text(label, m.body.position.x - 124, m.body.position.y - m.h / 2 - 13);

        stroke(255, 220, 120, 180);
        strokeWeight(1.5);
        const a = phase % TWO_PI;
        line(
          m.body.position.x, m.body.position.y - m.h / 2 - 3,
          m.body.position.x + Math.cos(a) * 18,
          m.body.position.y - m.h / 2 - 3 + Math.sin(a) * 18
        );
      }
      pop();
    }
  };

  /* ---------------------- resonancia y fatiga ----------------------- */

  const resonance = {
    init(state) {
      const source = Array.isArray(state.items)
        ? state.items
        : (Array.isArray(state.supports) ? state.supports : [state]);
      state.resonators = source.map((item, index) => ({
        id: item.id === undefined ? `resonator-${index}` : item.id,
        x: num(item.x, CONFIG.WIDTH / 2),
        y: num(item.y, CONFIG.GROUND_Y - 90),
        anchorY: num(item.anchorY, num(item.y, CONFIG.GROUND_Y - 90) - 80),
        w: Math.max(30, num(item.w, 180)),
        h: Math.max(10, num(item.h, 20)),
        mat: item.mat || 'steel',
        omega: Math.max(0.01, num(item.omega, 2)),
        naturalOmega: Math.max(0.01, num(item.naturalOmega, 2)),
        phase: num(item.phase, 0),
        amplitude: Math.max(0, num(item.amplitude, 0.2)),
        fatigueRate: Math.max(0, num(item.fatigueRate, 0.3)),
        fatigueLimit: Math.max(1, num(item.fatigueLimit, 100)),
        bandwidth: Math.max(0.01, num(item.bandwidth, 0.2)),
        fatigue: 0,
        body: null,
        constraint: null,
        broken: false
      }));
      if (!state.game || state.predict) return;

      for (const resonator of state.resonators) {
        const body = spawnBox(state, {
          t: 'box',
          x: resonator.x,
          y: resonator.y,
          w: resonator.w,
          h: resonator.h,
          mat: resonator.mat,
          density: 0.0018
        });
        if (!body) continue;
        body.game.resonatorId = resonator.id;
        const constraint = Matter.Constraint.create({
          pointA: { x: resonator.x, y: resonator.anchorY },
          bodyB: body,
          pointB: { x: 0, y: 0 },
          length: resonator.y - resonator.anchorY,
          stiffness: 0.012,
          damping: 0.08,
          render: { visible: false }
        });
        addConstraint(state, constraint);
        resonator.body = body;
        resonator.constraint = constraint;
      }
    },

    apply(state, bodies, step, all, opts) {
      for (const resonator of state.resonators) {
        if (resonator.broken || !resonator.body || resonator.body.game.removed) continue;
        const phase = (resonator.omega * step) / 60 + resonator.phase;
        const wave = Math.sin(phase);
        const force = stepAccelToForce(resonator.body, resonator.amplitude * wave);
        Matter.Body.applyForce(resonator.body, resonator.body.position, {
          x: 0,
          y: force
        });

        const detuning = Math.abs(resonator.omega - resonator.naturalOmega);
        if (detuning > resonator.bandwidth) continue;
        const response = 1 / (1 + Math.pow(detuning / resonator.bandwidth, 2));
        resonator.fatigue += resonator.fatigueRate * response * Math.abs(wave);
        if (resonator.fatigue < resonator.fatigueLimit) continue;

        resonator.broken = true;
        if (resonator.constraint) {
          Matter.Composite.remove(state.game.world, resonator.constraint);
          resonator.constraint = null;
        }
        if (state.game && !(opts && opts.silent)) {
          state.game.removeBody(resonator.body, 'fatigue');
          pushEvent(state, {
            type: 'resonanceBreak',
            id: resonator.id,
            x: resonator.x,
            y: resonator.y
          });
        }
      }
    },

    draw(state) {
      for (const resonator of state.resonators) {
        const x = resonator.body ? resonator.body.position.x : resonator.x;
        const y = resonator.body ? resonator.body.position.y : resonator.y;
        const anchorY = resonator.anchorY;
        stroke(210, 226, 238, 190);
        strokeWeight(2);
        for (let i = -3; i <= 3; i++) {
          const t = (i + 3) / 6;
          const sx = x + i * 5;
          line(sx, anchorY, x + i * 2, y - resonator.h / 2);
          if (i < 3) line(sx, anchorY + (y - anchorY) * t, sx + 5, anchorY + (y - anchorY) * (t + 1 / 6));
        }
        noStroke();
        useText(9, true);
        textAlign(CENTER, BOTTOM);
        fill(resonator.broken ? '#ff9a8b' : '#d6f2ff');
        text(
          `FATIGA ${Math.min(100, resonator.fatigue / resonator.fatigueLimit * 100).toFixed(0)}%`,
          x, anchorY - 8
        );
      }
    },

    overlay(state) {
      push();
      useText(10, true);
      textAlign(LEFT, TOP);
      for (const resonator of state.resonators) {
        const matched = Math.abs(resonator.omega - resonator.naturalOmega) <= resonator.bandwidth;
        fill(matched ? '#8ff09b' : '#ffd166');
        noStroke();
        text(
          `ω=${resonator.omega.toFixed(2)} · ω₀=${resonator.naturalOmega.toFixed(2)} · ${matched ? 'resonancia' : 'fuera de ritmo'}`,
          resonator.x - resonator.w / 2, resonator.y + resonator.h
        );
      }
      pop();
    }
  };

  /* ------------------------- poleas --------------------------------- */

  const pulleys = {
    init(state) {
      state.cut = false;
      state.pulleys = (state.items || []).map((p, i) => ({
        id: p.id === undefined ? `pulley-${i}` : p.id,
        x: num(p.x, 780),
        y: num(p.y, 250),
        r: Math.max(14, num(p.r, 34)),
        ropeLen: Math.max(40, num(p.ropeLen, 280)),
        left: p.left || {},
        right: p.right || {},
        cut: false,
        spin: 0,
        measured: 0,
        theoretical: 0,
        prevVL: null,
        prevVR: null,
        prevLeftY: null,
        sides: null
      }));

      if (!state.game || state.predict) return;

      for (const p of state.pulleys) {
        const wL = Math.max(10, num(p.left.w, 42));
        const hL = Math.max(10, num(p.left.h, 38));
        const wR = Math.max(10, num(p.right.w, 42));
        const hR = Math.max(10, num(p.right.h, 38));
        const sideLen = p.ropeLen / 2;
        // Por defecto las masas cuelgan verticales de los bordes de la
        // rueda: una cuerda diagonal añadiría un péndulo que falsea la
        // medición de Atwood.
        const leftX = num(p.left.x, p.x - p.r);
        const rightX = num(p.right.x, p.x + p.r);
        const leftY = num(p.left.y, p.y + sideLen + hL / 2);
        const rightY = num(p.right.y, p.y + sideLen + hR / 2);

        const left = spawnBox(state, {
          t: 'box',
          x: leftX,
          y: leftY,
          w: wL,
          h: hL,
          mat: p.left.mat || 'stone',
          density: p.left.density
        });
        const right = spawnBox(state, {
          t: 'box',
          x: rightX,
          y: rightY,
          w: wR,
          h: hR,
          mat: p.right.mat || 'stone',
          density: p.right.density
        });

        if (!left || !right) continue;

        left.game.pulley = p;
        right.game.pulley = p;
        left.game.pulleySide = 'left';
        right.game.pulleySide = 'right';
        left.game.hp = 999999;
        left.game.maxHp = 999999;
        left.game.damageMult = 0.02;
        right.game.hp = 999999;
        right.game.maxHp = 999999;
        right.game.damageMult = 0.02;
        // Sin rozamiento con el aire: la máquina de Atwood debe conservar
        // su aceleración teórica durante toda la caída.
        left.frictionAir = 0;
        right.frictionAir = 0;

        const anchorL = { x: p.x - p.r, y: p.y };
        const anchorR = { x: p.x + p.r, y: p.y };

        // La cuerda se modela con la tensión de Atwood y la corrección de
        // suma de desplazamientos de `apply`. No usamos Matter.Constraint:
        // sus muelles son bidireccionales y empujarían las masas lejos de
        // la rueda en cuanto la longitud declarada supera la distancia.
        p.sides = {
          left: {
            body: left,
            anchor: anchorL,
            constraint: null,
            h: hL,
            baseY: left.position.y,
            startY: left.position.y
          },
          right: {
            body: right,
            anchor: anchorR,
            constraint: null,
            h: hR,
            baseY: right.position.y,
            startY: right.position.y
          }
        };
        p.prevLeftY = left.position.y;
        p.prevVL = null;
        p.prevVR = null;
        // Recorrido máximo antes de que la masa que sube toque la rueda.
        // Evita que la cuerda "atraviese" la polea al agotarse.
        const m1 = left.mass;
        const m2 = right.mass;
        const riseClearL = Math.max(0, (left.position.y - hL / 2) - (p.y + p.r));
        const riseClearR = Math.max(0, (right.position.y - hR / 2) - (p.y + p.r));
        p.travelMax = m1 > m2 ? riseClearR : (m2 > m1 ? riseClearL : 0);
        p.theoretical = ((m1 - m2) / (m1 + m2)) * gravityStep();
      }
    },

    apply(state, bodies, step, all, opts) {
      if (!state.pulleys) return;
      const dtSq = CONFIG.STEP_MS * CONFIG.STEP_MS;

      for (const p of state.pulleys) {
        if (p.cut || !p.sides) continue;
        const L = p.sides.left;
        const R = p.sides.right;
        const lb = L.body;
        const rb = R.body;
        if (!lb || !rb || lb.game.removed || rb.game.removed) continue;

        // Tope de recorrido: cuando la masa que sube llega a la rueda, la
        // cuerda se agota y el sistema se detiene (no atraviesa la polea).
        if (p.travelMax > 0) {
          const travel = ((lb.position.y - L.startY) -
            (rb.position.y - R.startY)) / 2;
          if (Math.abs(travel) >= p.travelMax) {
            const dir = travel > 0 ? 1 : -1;
            Matter.Body.setPosition(lb, {
              x: lb.position.x,
              y: L.startY + dir * p.travelMax
            });
            Matter.Body.setPosition(rb, {
              x: rb.position.x,
              y: R.startY - dir * p.travelMax
            });
            Matter.Body.setVelocity(lb, { x: 0, y: 0 });
            Matter.Body.setVelocity(rb, { x: 0, y: 0 });
            continue;
          }
        }

        // La cuerda impone suma de desplazamientos constante. Si un cuerpo
        // baja d, el otro sube d: se corrige la componente común de la
        // velocidad y la posición antes de integrar.
        const vL = lb.velocity.y;
        const vR = rb.velocity.y;
        const common = (vL + vR) / 2;
        if (Math.abs(common) > 1e-4) {
          Matter.Body.setVelocity(lb, { x: lb.velocity.x, y: vL - common });
          Matter.Body.setVelocity(rb, { x: rb.velocity.x, y: vR - common });
        }

        const sumDisp = (lb.position.y - L.startY) + (rb.position.y - R.startY);
        if (Math.abs(sumDisp) > 0.5) {
          Matter.Body.setPosition(lb, {
            x: lb.position.x,
            y: lb.position.y - sumDisp / 2
          });
          Matter.Body.setPosition(rb, {
            x: rb.position.x,
            y: rb.position.y - sumDisp / 2
          });
        }

        // Tensión de Atwood: T = 2·m1·m2/(m1+m2) · g, hacia arriba en
        // ambos lados. La aceleración resultante es (m1−m2)/(m1+m2)·g.
        const m1 = lb.mass;
        const m2 = rb.mass;
        const tension = (2 * m1 * m2) / (m1 + m2);
        const force = tension * gravityStep() / dtSq;
        Matter.Body.applyForce(lb, lb.position, { x: 0, y: -force });
        Matter.Body.applyForce(rb, rb.position, { x: 0, y: -force });

        // Aceleración medida: media de los pasos en caída libre. Se congela
        // cuando una masa toca el suelo o llega a la rueda, para que
        // `measureAtwood()` no acabe leyendo el reposo del final.
        const aL = lb.velocity.y - p.prevVL;
        const aR = rb.velocity.y - p.prevVR;
        const bottomL = lb.position.y + L.h / 2;
        const topR = rb.position.y - R.h / 2;
        const blocked = bottomL >= CONFIG.GROUND_Y - 2 ||
          topR <= p.y + p.r + 2;
        if (!blocked && p.prevVL !== null && p.prevVR !== null) {
          p.freeSum = (p.freeSum || 0) + (aL - aR) / 2;
          p.freeCount = (p.freeCount || 0) + 1;
          p.measured = p.freeSum / p.freeCount;
        }
        p.prevVL = lb.velocity.y;
        p.prevVR = rb.velocity.y;
        p.theoretical = ((m1 - m2) / (m1 + m2)) * gravityStep();

        // Giro visual de la polea según el desplazamiento del ramo izquierdo.
        if (p.prevLeftY !== null) p.spin += (lb.position.y - p.prevLeftY) / p.r;
        p.prevLeftY = lb.position.y;

        if (!opts || !opts.silent) {
          if (Math.abs(lb.velocity.y) > 0.12 && step % 18 === 0) {
            pushEvent(state, {
              type: 'pulleyTick',
              x: p.x,
              y: p.y
            });
          }
        }
      }
    },

    checkCut(state, prev, curr, info) {
      if (!state.pulleys) return;
      const speed = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      if (speed < CONFIG.ROPE_CUT_SPEED) return;
      const radius = (info && info.radius) || CONFIG.BIRD_RADIUS;

      for (const p of state.pulleys) {
        if (p.cut || !p.sides) continue;
        const L = p.sides.left;
        const R = p.sides.right;
        if (!L.body || !R.body) continue;
        const segs = [
          {
            a: L.anchor,
            b: { x: L.body.position.x, y: L.body.position.y - L.h / 2 }
          },
          {
            a: R.anchor,
            b: { x: R.body.position.x, y: R.body.position.y - R.h / 2 }
          }
        ];

        for (const seg of segs) {
          if (segmentsNear(prev, curr, seg.a, seg.b, radius + CONFIG.ROPE_CUT_PAD)) {
            p.cut = true;
            state.cut = true;
            if (L.constraint) {
              Matter.Composite.remove(state.game.world, L.constraint);
              L.constraint = null;
            }
            if (R.constraint) {
              Matter.Composite.remove(state.game.world, R.constraint);
              R.constraint = null;
            }
            pushEvent(state, {
              type: 'ropeCut',
              x: (seg.a.x + seg.b.x) / 2,
              y: (seg.a.y + seg.b.y) / 2
            });
            return;
          }
        }
      }
    },

    draw(state) {
      if (!state.pulleys) return;
      for (const p of state.pulleys) {
        push();
        // ramos de cuerda
        if (p.sides) {
          const L = p.sides.left;
          const R = p.sides.right;
          strokeCap(ROUND);
          for (const side of [L, R]) {
            if (!side.body || side.body.game.removed) continue;
            const end = {
              x: side.body.position.x,
              y: side.body.position.y - side.h / 2
            };
            if (p.cut) {
              stroke(90, 62, 40, 220);
              strokeWeight(3);
              line(side.anchor.x, side.anchor.y, side.anchor.x, side.anchor.y + 24);
              stroke(90, 62, 40, 160);
              line(end.x, end.y, end.x, end.y - 18);
            } else {
              stroke(74, 44, 25);
              strokeWeight(6);
              line(side.anchor.x, side.anchor.y, end.x, end.y);
              stroke(196, 164, 112);
              strokeWeight(2);
              line(side.anchor.x, side.anchor.y, end.x, end.y);
            }
          }
        }

        // soporte y rueda
        noStroke();
        fill(20, 26, 32, 70);
        rect(p.x - 10, p.y - p.r - 26, 20, 26, 4);
        fill('#5d6874');
        rect(p.x - 14, p.y - p.r - 30, 28, 10, 3);

        fill('#33404c');
        stroke('#aab8c4');
        strokeWeight(3);
        circle(p.x, p.y, p.r * 2);
        noFill();
        stroke(210, 226, 238, 110);
        strokeWeight(2);
        circle(p.x, p.y, p.r * 1.45);

        push();
        translate(p.x, p.y);
        rotate(p.spin);
        stroke(210, 228, 240, 190);
        strokeWeight(3);
        for (let i = 0; i < 4; i++) {
          const a = i * (PI / 2);
          line(0, 0, Math.cos(a) * (p.r - 8), Math.sin(a) * (p.r - 8));
        }
        noStroke();
        fill('#dce9f2');
        circle(0, 0, 9);
        pop();

        if (p.cut) {
          noStroke();
          useText(10, true);
          textAlign(CENTER, BOTTOM);
          fill('#ff9a8b');
          text('CUERDA CORTADA', p.x, p.y - p.r - 34);
        }
        pop();
      }
    },

    overlay(state) {
      if (!state.pulleys) return;
      const gStep = gravityStep();
      push();
      useText(10, true);
      for (const p of state.pulleys) {
        if (!p.sides) continue;
        const L = p.sides.left;
        const R = p.sides.right;
        if (!L.body || !R.body) continue;

        const w1 = L.body.mass * gStep;
        const w2 = R.body.mass * gStep;
        drawArrow(L.body.position.x, L.body.position.y, 0, 1, 18 + w1 * 900, '#ffc17a', 'P1');
        drawArrow(R.body.position.x, R.body.position.y, 0, 1, 18 + w2 * 900, '#ffc17a', 'P2');

        const theo = p.theoretical;
        const meas = p.measured;
        const err = Math.abs(theo) > 1e-6 ? (meas - theo) / theo * 100 : 0;
        const x = p.x + p.r + 26;
        const y = p.y - 20;
        noStroke();
        fill(8, 18, 26, 178);
        rect(x, y, 224, 58, 8);
        fill('#ffe6a8');
        textAlign(LEFT, TOP);
        text(`a teórica ${theo.toFixed(3)} px/paso²`, x + 10, y + 6);
        text(`a medida  ${meas.toFixed(3)} px/paso²`, x + 10, y + 21);
        fill(Math.abs(err) <= 15 ? '#8ff09b' : '#ff9a8b');
        text(`error ${err.toFixed(0)}% · ${accelToMs2(Math.abs(theo)).toFixed(1)} m/s²`, x + 10, y + 36);
      }
      pop();
    }
  };

  function segmentsNear(prev, curr, a, b, pad) {
    const d = Math.min(
      pointToSegment(prev.x, prev.y, a.x, a.y, b.x, b.y),
      pointToSegment(curr.x, curr.y, a.x, a.y, b.x, b.y),
      pointToSegment(a.x, a.y, prev.x, prev.y, curr.x, curr.y),
      pointToSegment(b.x, b.y, prev.x, prev.y, curr.x, curr.y)
    );
    return d <= pad;
  }

  function pointToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = clampLocal(t, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function drawArrow(x, y, ux, uy, len, colorText, label) {
    stroke(colorText);
    strokeWeight(2);
    line(x, y, x + ux * len, y + uy * len);
    noStroke();
    fill(colorText);
    push();
    translate(x + ux * len, y + uy * len);
    rotate(Math.atan2(uy, ux));
    triangle(0, 0, -8, -4, -8, 4);
    pop();
    if (label) {
      useText(9, true);
      textAlign(LEFT, CENTER);
      fill(colorText);
      text(label, x + ux * len + 8, y + uy * len);
    }
  }

  /* --------------------------- imanes ------------------------------- */

  const magnets = {
    init(state) {
      state.magnets = (state.items || []).map((m, i) => ({
        id: m.id === undefined ? `magnet-${i}` : m.id,
        x: num(m.x, CONFIG.WIDTH / 2),
        y: num(m.y, CONFIG.HEIGHT / 2),
        radius: Math.max(16, num(m.radius, CONFIG.FIELD_MAGNET_RADIUS)),
        strength: Math.max(0, num(m.strength, CONFIG.FIELD_MAGNET_STRENGTH)),
        rmin: Math.max(1, num(m.rmin, CONFIG.FIELD_MAGNET_RMIN)),
        on: m.on !== false,
        invert: !!m.invert,
        switchId: m.switchId === undefined ? null : m.switchId,
        active: m.on !== false,
        wasActive: null
      }));
    },

    activeFor(state, m) {
      if (m.switchId === null || m.switchId === undefined) return m.on;
      const lit = switchActive(state, m.switchId);
      return m.invert ? lit : !lit;
    },

    apply(state, bodies, step, all, opts) {
      if (!state.magnets) return;
      let anyHum = false;

      for (const m of state.magnets) {
        m.active = this.activeFor(state, m);
        if (m.wasActive === null) m.wasActive = m.active;
        if (m.active !== m.wasActive) {
          m.wasActive = m.active;
          if (!opts || !opts.silent) {
            pushEvent(state, {
              type: 'magnetOn',
              x: m.x,
              y: m.y,
              on: m.active
            });
          }
        }
        if (!m.active || !(m.strength > 0)) continue;

        for (const body of bodies) {
          if (!body || body.isStatic || body.isSensor) continue;
          const ferrous = body.ferrous || (body.game && body.game.ferrous);
          if (!ferrous) continue;
          if (!(body.mass > 0)) continue;

          const dx = m.x - body.position.x;
          const dy = m.y - body.position.y;
          const r = Math.max(Math.hypot(dx, dy), m.rmin);
          const f = (m.strength * body.mass) / (r * r);
          Matter.Body.applyForce(body, body.position, {
            x: (dx / r) * f,
            y: (dy / r) * f
          });
          anyHum = true;
        }
      }

      if (anyHum && (!opts || !opts.silent) && step % 30 === 0) {
        pushEvent(state, { type: 'magnetHum' });
      }
    },

    drawBack(state) {
      if (!state.magnets) return;
      for (const m of state.magnets) {
        push();
        noFill();
        const baseA = m.active ? 90 : 26;
        for (let i = 1; i <= 3; i++) {
          stroke(130, 214, 255, baseA / i);
          strokeWeight(1.2);
          circle(m.x, m.y, m.radius * 2 * (i / 3));
        }
        // líneas de campo tenues
        stroke(130, 214, 255, m.active ? 38 : 14);
        strokeWeight(1);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TWO_PI + state.step * 0.004;
          line(
            m.x + Math.cos(a) * m.radius * 0.24,
            m.y + Math.sin(a) * m.radius * 0.24,
            m.x + Math.cos(a) * m.radius,
            m.y + Math.sin(a) * m.radius
          );
        }
        pop();
      }
    },

    draw(state) {
      if (!state.magnets) return;
      for (const m of state.magnets) {
        push();
        translate(m.x, m.y);
        const active = m.active;
        const pulse = 0.5 + 0.5 * Math.sin(state.step * 0.14 + m.x);

        // bobina
        noFill();
        stroke(active ? '#8fdcff' : '#5a6570');
        strokeWeight(3);
        for (let i = 0; i < 3; i++) {
          ellipse(0, 0, 34 + i * 10, 54 + i * 4);
        }
        noStroke();
        fill(active ? '#4b8db0' : '#3c454f');
        rect(-15, -18, 30, 36, 5);
        fill(active ? '#bdefff' : '#7b8792');
        rect(-11, -22, 22, 12, 3);
        fill(active ? '#ffffff' : '#c1c9d1');
        rect(-11, 10, 22, 12, 3);

        if (active) {
          // chispas deterministas alrededor de la bobina
          for (let i = 0; i < 7; i++) {
            const a = hash01(i * 13 + state.step * 0.7) * TWO_PI;
            const r = 22 + hash01(i * 7 + 3) * 14;
            const len = 2 + hash01(i * 19 + 1) * 4;
            stroke(180, 236, 255, 160);
            strokeWeight(1.2);
            line(
              Math.cos(a) * r, Math.sin(a) * r,
              Math.cos(a) * (r + len), Math.sin(a) * (r + len)
            );
          }
          noStroke();
          fill(160, 230, 255, 22 + 20 * pulse);
          circle(0, 0, 72);
        }
        pop();
      }
    },

    overlay(state) {
      if (!state.magnets) return;
      push();
      useText(9.5, true);
      textAlign(CENTER, TOP);
      for (const m of state.magnets) {
        fill(m.active ? '#bdefff' : 'rgba(200,215,230,0.55)');
        noStroke();
        text(
          `IMÁN ${m.active ? 'ON' : 'OFF'} · F=${m.strength.toFixed(0)}·m/r²`,
          m.x, m.y + m.radius + 5
        );
      }
      pop();
    }
  };

  /* ---------------------- láser y espejos --------------------------- */

  const lasers = {
    init(state) {
      state.lasers = (state.items || []).map((l, i) => ({
        id: l.id === undefined ? `laser-${i}` : l.id,
        x: num(l.x, 640),
        y: num(l.y, 200),
        angle: num(l.angle, 0),
        targetId: l.targetId === undefined ? null : l.targetId,
        mirrorsDef: Array.isArray(l.mirrors) ? l.mirrors : [],
        mirrors: [],
        beam: null,
        bounces: [],
        lit: false,
        wasLit: false
      }));
      state.targetLit = {};
      state.prevLit = {};

      if (!state.game || state.predict) return;

      for (const laser of state.lasers) {
        for (const md of laser.mirrorsDef) {
          const len = Math.max(24, num(md.len, 100));
          const rotatable = !!md.rotatable;
          const body = spawnBox(state, {
            t: 'box',
            x: num(md.x, 640),
            y: num(md.y, 300),
            w: len,
            h: 9,
            mat: 'steel',
            isStatic: !rotatable,
            angle: num(md.angle, 0)
          });
          if (!body) continue;

          body.game.kind = 'mirror';
          body.game.mirror = true;
          body.game.hp = 999999;
          body.game.maxHp = 999999;
          body.game.damageMult = 0.02;

          let constraint = null;
          if (rotatable) {
            constraint = Matter.Constraint.create({
              pointA: { x: body.position.x, y: body.position.y },
              bodyB: body,
              pointB: { x: 0, y: 0 },
              length: 0,
              stiffness: 1,
              damping: 0.12,
              render: { visible: false }
            });
            addConstraint(state, constraint);
          }

          laser.mirrors.push({
            def: md,
            body: body,
            len: len,
            h: 9,
            rotatable: rotatable,
            constraint: constraint
          });
        }
      }
    },

    mirrorSegment(mirror) {
      const body = mirror.body;
      if (!body || !body.game || body.game.removed) return null;
      const a = body.angle;
      const hx = Math.cos(a) * mirror.len / 2;
      const hy = Math.sin(a) * mirror.len / 2;
      return {
        x1: body.position.x - hx,
        y1: body.position.y - hy,
        x2: body.position.x + hx,
        y2: body.position.y + hy,
        nx: -Math.sin(a),
        ny: Math.cos(a)
      };
    },

    raySegment(ox, oy, dx, dy, seg) {
      const sx = seg.x2 - seg.x1;
      const sy = seg.y2 - seg.y1;
      const denom = dx * sy - dy * sx;
      if (Math.abs(denom) < 1e-9) return null;
      const t = ((seg.x1 - ox) * sy - (seg.y1 - oy) * sx) / denom;
      const u = ((seg.x1 - ox) * dy - (seg.y1 - oy) * dx) / denom;
      if (t <= 0.01 || u < -0.01 || u > 1.01) return null;
      return t;
    },

    rayCircle(ox, oy, dx, dy, cx, cy, r) {
      const fx = ox - cx;
      const fy = oy - cy;
      const b = 2 * (fx * dx + fy * dy);
      const c = fx * fx + fy * fy - r * r;
      const disc = b * b - 4 * c;
      if (disc < 0) return null;
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / 2;
      const t2 = (-b + sq) / 2;
      if (t1 > 0.01) return t1;
      if (t2 > 0.01) return t2;
      return null;
    },

    cast(state, laser) {
      let ox = laser.x;
      let oy = laser.y;
      let angle = laser.angle;
      let dx = Math.cos(angle);
      let dy = Math.sin(angle);
      const points = [{ x: ox, y: oy }];
      const bounces = [];
      let lit = false;
      let targetBody = switchBody(state, laser.targetId);

      for (let bounce = 0; bounce <= CONFIG.FIELD_LASER_MAX_BOUNCE; bounce++) {
        let nearestT = Infinity;
        let hitMirror = null;
        let hitTarget = false;
        let seg = null;

        for (const mirror of laser.mirrors) {
          seg = this.mirrorSegment(mirror);
          if (!seg) continue;
          const t = this.raySegment(ox, oy, dx, dy, seg);
          if (t !== null && t < nearestT) {
            nearestT = t;
            hitMirror = mirror;
            hitTarget = false;
          }
        }

        if (targetBody && targetBody.game) {
          const tr = targetBody.game.r || 24;
          const t = this.rayCircle(
            ox, oy, dx, dy,
            targetBody.position.x, targetBody.position.y, tr
          );
          if (t !== null && t < nearestT) {
            nearestT = t;
            hitTarget = true;
            hitMirror = null;
          }
        }

        if (nearestT === Infinity || nearestT > CONFIG.FIELD_LASER_RANGE) {
          points.push({
            x: ox + dx * CONFIG.FIELD_LASER_RANGE,
            y: oy + dy * CONFIG.FIELD_LASER_RANGE
          });
          break;
        }

        const hx = ox + dx * nearestT;
        const hy = oy + dy * nearestT;
        points.push({ x: hx, y: hy });

        if (hitTarget) {
          lit = true;
          break;
        }

        if (!hitMirror) break;

        const mirrorSeg = this.mirrorSegment(hitMirror);
        if (!mirrorSeg) break;
        const nx = mirrorSeg.nx;
        const ny = mirrorSeg.ny;
        const dot = dx * nx + dy * ny;
        const rdx = dx - 2 * dot * nx;
        const rdy = dy - 2 * dot * ny;
        const incidence = Math.acos(clampLocal(Math.abs(dot), 0, 1));

        bounces.push({
          x: hx,
          y: hy,
          nx: nx,
          ny: ny,
          incidence: incidence,
          reflection: incidence
        });

        dx = rdx;
        dy = rdy;
        const mag = Math.hypot(dx, dy) || 1;
        dx /= mag;
        dy /= mag;
        angle = Math.atan2(dy, dx);

        // pequeño avance para no volver a detectar el mismo espejo en t=0
        ox = hx + dx * 0.05;
        oy = hy + dy * 0.05;
      }

      laser.beam = points;
      laser.bounces = bounces;
      laser.lit = lit;
      return { points: points, bounces: bounces, lit: lit };
    },

    apply(state, bodies, step, all, opts) {
      if (!state.lasers || state.predict || !state.game) return;

      // Cada paso se recalcula la iluminación desde cero (varios láseres
      // pueden apuntar al mismo reactor: basta con que uno lo ilumine).
      for (const key of Object.keys(state.targetLit)) state.targetLit[key] = false;

      for (const laser of state.lasers) {
        this.cast(state, laser);
        if (laser.lit && laser.targetId !== null && laser.targetId !== undefined) {
          state.targetLit[String(laser.targetId)] = true;
        }
      }

      const keys = Object.keys(state.targetLit);
      for (const key of keys) {
        const lit = !!state.targetLit[key];
        if (state.prevLit[key] === lit) continue;
        state.prevLit[key] = lit;
        const target = switchBody(state, key);
        pushEvent(state, {
          type: 'laserTarget',
          id: key,
          lit: lit,
          x: target ? target.position.x : 0,
          y: target ? target.position.y : 0
        });
      }

      if ((!opts || !opts.silent) && step % 45 === 0) {
        const anyLit = keys.some((k) => state.targetLit[k]);
        if (anyLit) pushEvent(state, { type: 'laserPulse' });
      }
    },

    draw(state) {
      if (!state.lasers) return;
      push();
      for (const laser of state.lasers) {
        const points = laser.beam;
        if (!points || points.length < 2) continue;

        // varias capas con alpha decreciente: brillo del rayo
        const layers = [
          { w: 13, a: 18 },
          { w: 6, a: 52 },
          { w: 2.4, a: 210 }
        ];
        for (const layer of layers) {
          stroke(255, 84, 110, layer.a);
          strokeWeight(layer.w);
          strokeCap(ROUND);
          for (let i = 0; i < points.length - 1; i++) {
            line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
          }
        }

        // emisor
        const x = points[0].x;
        const y = points[0].y;
        noStroke();
        fill(255, 92, 112, 210);
        circle(x, y, 16);
        fill(255, 238, 242, 220);
        circle(x, y, 6);

        // partícula en cada reflexión
        for (const b of laser.bounces) {
          noStroke();
          fill(255, 120, 140, 90);
          circle(b.x, b.y, 18);
          fill(255, 245, 248, 210);
          circle(b.x, b.y, 5);
          for (let i = 0; i < 3; i++) {
            const a = hash01(i * 9 + b.x) * TWO_PI;
            const r = 8 + hash01(i * 7 + b.y) * 8;
            stroke(255, 150, 168, 150);
            strokeWeight(1);
            line(
              b.x + Math.cos(a) * 4, b.y + Math.sin(a) * 4,
              b.x + Math.cos(a) * r, b.y + Math.sin(a) * r
            );
          }
        }

        if (laser.lit) {
          noStroke();
          fill(255, 90, 112, 18);
          circle(points[points.length - 1].x, points[points.length - 1].y, 34);
        }
      }
      pop();
    },

    overlay(state) {
      if (!state.lasers) return;
      push();
      useText(9.5, true);
      for (const laser of state.lasers) {
        for (const b of laser.bounces) {
          noStroke();
          fill(8, 18, 26, 170);
          rect(b.x - 52, b.y - 24, 104, 17, 4);
          fill('#ffb4c0');
          textAlign(CENTER, CENTER);
          text(
            `i ${(b.incidence * 180 / PI).toFixed(0)}° = r ${(b.reflection * 180 / PI).toFixed(0)}°`,
            b.x, b.y - 15
          );
          stroke(255, 180, 195, 90);
          strokeWeight(1);
          line(
            b.x - b.nx * 16, b.y - b.ny * 16,
            b.x + b.nx * 16, b.y + b.ny * 16
          );
        }
        if (laser.targetId !== null && laser.targetId !== undefined) {
          fill(laser.lit ? '#8ff09b' : '#ff9a8b');
          textAlign(LEFT, TOP);
          noStroke();
          text(
            `REACTOR ${laser.targetId}: ${laser.lit ? 'ILUMINADO' : 'A OSCURAS'}`,
            laser.x + 14, laser.y + 10
          );
        }
      }
      pop();
    }
  };

  /* -------------------------- térmica ------------------------------- */

  const thermal = {
    init(state) {
      state.fires = (state.fires || []).map((f, i) => ({
        x: num(f.x, CONFIG.WIDTH / 2),
        y: num(f.y, CONFIG.GROUND_Y - 20),
        r: Math.max(12, num(f.r, 70)),
        fireSwitchId: f.fireSwitchId === undefined ? null : f.fireSwitchId,
        invert: !!f.invert,
        baseOn: f.on !== false,
        active: f.on !== false,
        wasActive: null,
        id: f.id === undefined ? `fire-${i}` : f.id
      }));
      state.iceDefs = (state.ice || []).map((b, i) => ({
        id: b.id === undefined ? `ice-${i}` : b.id,
        x: num(b.x, CONFIG.WIDTH / 2),
        y: num(b.y, CONFIG.GROUND_Y - 80),
        w: Math.max(10, num(b.w, 40)),
        h: Math.max(10, num(b.h, 80)),
        meltRate: Math.max(0.01, num(b.meltRate, CONFIG.FIELD_ICE_MELT_RATE)),
        meltFriction: clampLocal(num(b.meltFriction, 0.02), 0, 1)
      }));
      state.entries = [];
      if (!state.game || state.predict) return;

      for (const def of state.iceDefs) {
        const body = spawnBox(state, {
          t: 'box',
          x: def.x,
          y: def.y,
          w: def.w,
          h: def.h,
          mat: 'ice'
        });
        if (!body) continue;
        body.game.ice = true;
        body.game.temperature = 0;
        body.game.iceId = def.id;
        body.game.meltRate = def.meltRate;
        body.game.meltFriction = def.meltFriction;
        const baseFriction = body.friction;
        state.entries.push({
          id: def.id,
          body: body,
          temp: 0,
          meltRate: def.meltRate,
          meltFriction: def.meltFriction,
          baseFriction: baseFriction,
          melted: false,
          drip: 0
        });
      }
    },

    fireActive(state, fire) {
      if (fire.fireSwitchId === null || fire.fireSwitchId === undefined) {
        return fire.baseOn;
      }
      const lit = switchActive(state, fire.fireSwitchId);
      return fire.invert ? !lit : lit;
    },

    apply(state, bodies, step, all, opts) {
      if (!state.fires) return;
      const silent = !!(opts && opts.silent);
      let anyFire = false;

      for (const fire of state.fires) {
        fire.active = this.fireActive(state, fire);
        if (fire.wasActive === null) fire.wasActive = fire.active;
        if (fire.active !== fire.wasActive) {
          fire.wasActive = fire.active;
          if (!silent) {
            pushEvent(state, {
              type: 'fireOn',
              x: fire.x,
              y: fire.y,
              on: fire.active
            });
          }
        }
        if (fire.active) anyFire = true;
      }

      for (const entry of state.entries) {
        if (entry.melted) continue;
        const body = entry.body;
        if (!body || !body.game || body.game.removed) continue;

        let heat = 0;
        for (const fire of state.fires) {
          if (!fire.active) continue;
          const d = dist(body.position.x, body.position.y, fire.x, fire.y);
          if (d >= fire.r) continue;
          heat += entry.meltRate * (1 - d / fire.r);
        }

        if (heat > 0) {
          entry.temp = Math.min(CONFIG.FIELD_ICE_MAX_TEMP, entry.temp + heat);
        } else {
          entry.temp = Math.max(0, entry.temp - 0.08);
        }
        body.game.temperature = entry.temp;
        const meltRatio = entry.temp / CONFIG.FIELD_ICE_MAX_TEMP;
        const friction = entry.baseFriction +
          (entry.meltFriction - entry.baseFriction) * meltRatio;
        Matter.Body.set(body, 'friction', friction);
        Matter.Body.set(body, 'frictionStatic', friction);

        if (entry.temp >= CONFIG.FIELD_ICE_MAX_TEMP - 1e-6) {
          entry.melted = true;
          body.game.melted = true;
          if (!silent) {
            pushEvent(state, {
              type: 'iceMelt',
              x: body.position.x,
              y: body.position.y,
              body: body,
              id: entry.id
            });
          }
        }
      }

      if (anyFire && !silent && step % 22 === 0) {
        pushEvent(state, { type: 'crackle' });
      }
    },

    drawBack(state) {
      if (!state.fires) return;
      for (const fire of state.fires) {
        if (!fire.active) continue;
        push();
        noStroke();
        const pulse = 0.5 + 0.5 * Math.sin(state.step * 0.16 + fire.x);
        for (let i = 3; i >= 1; i--) {
          fill(255, 140, 70, 5 + 4 * pulse);
          circle(fire.x, fire.y, fire.r * 2 + i * 26);
        }
        pop();
      }
    },

    draw(state) {
      if (!state.fires) return;
      for (const fire of state.fires) {
        if (!fire.active) continue;
        push();
        noStroke();
        const pulse = 0.5 + 0.5 * Math.sin(state.step * 0.2 + String(fire.id).length);

        // base de brasas
        fill(255, 120, 45, 80);
        ellipse(fire.x, fire.y + 4, fire.r * 0.7, fire.r * 0.22);

        // llamas procedurales: partículas que suben y se apagan
        for (let i = 0; i < 16; i++) {
          const life = (state.step * 0.028 + i * 0.173 + hash01(i * 3 + fire.x)) % 1;
          const spread = (1 - life) * fire.r * 0.36;
          const px = fire.x + Math.sin(state.step * 0.08 + i * 2.3) * spread;
          const py = fire.y - life * fire.r * 1.08;
          const size = (1 - life) * (7 + 8 * hash01(i * 11 + 4)) * (0.7 + 0.4 * pulse);
          const a = 110 + 125 * (1 - life);
          if (i % 3 === 0) fill(255, 235, 160, a);
          else if (i % 3 === 1) fill(255, 166, 70, a);
          else fill(244, 94, 54, a);
          ellipse(px, py, size, size * 1.5);
        }

        // núcleo
        fill(255, 245, 205, 150 + 60 * pulse);
        ellipse(fire.x, fire.y - fire.r * 0.12, fire.r * 0.26, fire.r * 0.5);
        pop();
      }

      // gotas de hielo
      for (const entry of state.entries) {
        if (!entry.body || entry.body.game.removed) continue;
        if (entry.temp < 4 || entry.melted) continue;
        const b = entry.body;
        const amount = clampLocal(entry.temp / 100, 0, 1);
        push();
        noStroke();
        for (let i = 0; i < 3; i++) {
          const phase = (state.step * 0.025 + i * 0.37) % 1;
          const dx = (i - 1) * (b.game.w * 0.22);
          fill(190, 238, 255, 120 + 90 * amount);
          ellipse(
            b.position.x + dx,
            b.position.y + b.game.h / 2 + phase * 26,
            3 + amount * 2,
            6 + phase * 7
          );
        }
        pop();
      }
    },

    overlay(state) {
      if (!state.fires) return;
      push();
      useText(9, true);
      textAlign(CENTER, TOP);
      for (const entry of state.entries) {
        if (!entry.body || entry.body.game.removed) continue;
        const b = entry.body;
        noStroke();
        fill(8, 18, 26, 160);
        rect(b.position.x - 34, b.position.y - b.game.h / 2 - 20, 68, 15, 4);
        fill(entry.temp >= 100 ? '#ff9a8b' : '#bdefff');
        text(`${entry.temp.toFixed(0)} / 100 °C`, b.position.x, b.position.y - b.game.h / 2 - 18);
      }
      for (const fire of state.fires) {
        fill(fire.active ? '#ffc17a' : 'rgba(255,255,255,0.4)');
        text(
          fire.fireSwitchId === null
            ? `FUEGO ${fire.active ? 'ON' : 'OFF'}`
            : `FUEGO · ${fire.fireSwitchId} ${fire.active ? 'ON' : 'OFF'}`,
          fire.x, fire.y + fire.r * 0.55
        );
      }
      pop();
    }
  };

  /* ---------------------------- registro ---------------------------- */

  registry.wells = wells;
  registry.gravityZones = gravityZones;
  registry.movers = movers;
  registry.resonance = resonance;
  registry.pulleys = pulleys;
  registry.magnets = magnets;
  registry.lasers = lasers;
  registry.thermal = thermal;
})();
