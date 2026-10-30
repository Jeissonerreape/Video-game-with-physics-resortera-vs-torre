/* =====================================================================
   Resortera vs. Torre — CAMPOS
   ---------------------------------------------------------------------
   Sistema de fuerzas ambientales configuradas por DATOS en el nivel:
     fields: { wind: {...}, water: {...} }
   Cada campo es un módulo del registro `Fields.registry` con la misma
   firma. Añadir un campo nuevo = escribir un módulo y registrarlo aquí.
   Sin `fields`, `Fields.apply` no toca ningún cuerpo: el Clásico sigue
   exactamente igual que antes.

   El paso (`step`) es el contador entero de pasos de física desde que se
   cargó el nivel. Nunca se usa tiempo real ni aleatoriedad aquí.
   ===================================================================== */

const Fields = (function () {
  const registry = {};

  function clampLocal(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function copyObject(obj) {
    const out = {};
    for (const key of Object.keys(obj || {})) out[key] = obj[key];
    return out;
  }

  /** Copia una definición de campo: objeto para viento/agua, lista para
      los campos avanzados (wells, movers, pulleys...). */
  function copyDefinition(raw) {
    if (Array.isArray(raw)) return { items: raw.slice() };
    return copyObject(raw);
  }

  function cloneData(value) {
    if (Array.isArray(value)) return value.map(cloneData);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const key of Object.keys(value)) out[key] = cloneData(value[key]);
    return out;
  }

  function scaleFields(fields, intensity) {
    if (!fields || typeof fields !== 'object') return fields || null;
    const scale = Math.max(0, num(intensity, 1));
    const out = cloneData(fields);

    if (out.wind) {
      out.wind.fx = num(out.wind.fx, 0) * scale;
      out.wind.fy = num(out.wind.fy, 0) * scale;
      out.wind.gust = num(out.wind.gust, 0) * scale;
    }
    if (Array.isArray(out.wells)) {
      for (const well of out.wells) well.k = num(well.k, CONFIG.FIELD_WELL_K) * scale;
    }
    if (Array.isArray(out.gravityZones)) {
      for (const zone of out.gravityZones) {
        zone.g = clampLocal(
          num(zone.g, CONFIG.FIELD_ZONE_MIN_G) * scale,
          CONFIG.FIELD_ZONE_MIN_G,
          CONFIG.FIELD_ZONE_MAX_G
        );
      }
    }
    if (out.water) {
      out.water.drag = num(out.water.drag, CONFIG.FIELD_WATER_DRAG) * scale;
      out.water.rise = num(out.water.rise, 0) * scale;
      if (Number.isFinite(Number(out.water.riseMax))) {
        out.water.riseMax = Number(out.water.riseMax) * scale;
      }
    }
    if (Array.isArray(out.movers)) {
      for (const mover of out.movers) {
        mover.ax = num(mover.ax, 0) * scale;
        mover.ay = num(mover.ay, 0) * scale;
        mover.omega = num(mover.omega, 1) * scale;
      }
    }
    if (Array.isArray(out.magnets)) {
      for (const magnet of out.magnets) {
        magnet.strength = num(magnet.strength, CONFIG.FIELD_MAGNET_STRENGTH) * scale;
      }
    }
    if (out.thermal && Array.isArray(out.thermal.ice)) {
      for (const ice of out.thermal.ice) {
        ice.meltRate = num(ice.meltRate, CONFIG.FIELD_ICE_MELT_RATE) * scale;
      }
    }
    if (out.resonance) {
      const resonators = Array.isArray(out.resonance) ? out.resonance : [out.resonance];
      for (const resonator of resonators) {
        resonator.amplitude = num(resonator.amplitude, 0.2) * scale;
        resonator.omega = num(resonator.omega, 2) * scale;
        resonator.naturalOmega = num(resonator.naturalOmega, 2) * scale;
        resonator.fatigueRate = num(resonator.fatigueRate, 0.3) * scale;
      }
    }

    return out;
  }

  /** Ruido determinista de presentación (no interviene en la física). */
  function hash01(n) {
    const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  /* ------------------------ geometría del agua ---------------------- */

  /**
   * Fracción del cuerpo por debajo de la superficie y centro de la parte
   * sumergida. Los círculos usan la fórmula exacta del segmento circular;
   * los polígonos (cajas, palancas, fichas) se recortan contra la línea
   * de agua y se calcula el área y el centroide del trozo resultante.
   */
  function submergedInfo(body, surfaceY) {
    if (!body) return { fraction: 0, cx: 0, cy: 0 };

    const r = body.circleRadius;
    if (r > 0) {
      const cx = body.position.x;
      const cy = body.position.y;
      const top = cy - r;
      const bottom = cy + r;

      // y crece hacia abajo: la superficie está por encima del cuerpo si
      // su cota es menor que el borde superior.
      if (surfaceY >= bottom) return { fraction: 0, cx: cx, cy: bottom };
      if (surfaceY <= top) return { fraction: 1, cx: cx, cy: cy };

      const depth = bottom - surfaceY; // altura del segmento sumergido
      const cosHalf = clampLocal((r - depth) / r, -1, 1);
      const theta = 2 * Math.acos(cosHalf);
      const area = 0.5 * r * r * (theta - Math.sin(theta));
      const denom = 3 * (theta - Math.sin(theta));
      const offset = denom > 1e-9
        ? (4 * r * Math.pow(Math.sin(theta / 2), 3)) / denom
        : 0;

      return {
        fraction: clampLocal(area / (Math.PI * r * r), 0, 1),
        cx: cx,
        cy: cy + offset
      };
    }

    const bounds = body.bounds;
    if (!bounds) return { fraction: 0, cx: body.position.x, cy: body.position.y };
    if (bounds.max.y <= surfaceY) return { fraction: 0, cx: body.position.x, cy: body.position.y };
    if (bounds.min.y >= surfaceY) return { fraction: 1, cx: body.position.x, cy: body.position.y };

    const clipped = clipPolygonBelow(body.vertices, surfaceY);
    if (clipped.length < 3) return { fraction: 0, cx: body.position.x, cy: body.position.y };

    const area = polygonAreaCentroid(clipped);
    const total = body.area || 1;
    return {
      fraction: clampLocal(area.area / total, 0, 1),
      cx: area.cx,
      cy: area.cy
    };
  }

  /** Recorta un polígono convexo contra el semiespacio y >= surfaceY. */
  function clipPolygonBelow(vertices, surfaceY) {
    const out = [];
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const a = vertices[i];
      const b = vertices[(i + 1) % n];
      const aIn = a.y >= surfaceY;
      const bIn = b.y >= surfaceY;

      if (aIn) out.push({ x: a.x, y: a.y });
      if (aIn !== bIn) {
        const dy = b.y - a.y;
        const t = dy !== 0 ? (surfaceY - a.y) / dy : 0;
        out.push({
          x: a.x + (b.x - a.x) * t,
          y: surfaceY
        });
      }
    }
    return out;
  }

  /** Área (positiva) y centroide de un polígono simple. */
  function polygonAreaCentroid(poly) {
    let signed = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const cross = a.x * b.y - b.x * a.y;
      signed += cross;
      cx += (a.x + b.x) * cross;
      cy += (a.y + b.y) * cross;
    }

    signed *= 0.5;
    if (Math.abs(signed) < 1e-9) {
      return { area: 0, cx: 0, cy: 0 };
    }

    return {
      area: Math.abs(signed),
      cx: cx / (6 * signed),
      cy: cy / (6 * signed)
    };
  }

  /* ------------------------------ viento ---------------------------- */

  const windField = {
    init(state) {
      state.fx = num(state.fx, 0);
      state.fy = num(state.fy, 0);
      state.gust = Math.max(0, num(state.gust, 0));
      state.period = Math.max(0, num(state.period, 0));
      state.drag = state.drag !== false;
      state.step = 0;
    },

    /** Velocidad del viento (px/paso) en el paso actual. */
    effective(state, step) {
      let gust = 1;
      if (state.gust > 0 && state.period > 0) {
        gust = 1 + state.gust * Math.sin((step / state.period) * Math.PI * 2);
      }
      return { x: state.fx * gust, y: state.fy };
    },

    apply(state, bodies, step, all, opts) {
      // La fuerza es proporcional al ÁREA, no a la masa: con la misma
      // fuerza, un cuerpo ligero acelera más (a = F / m).
      const c = CONFIG.FIELD_WIND_C;
      const maxForce = CONFIG.FIELD_WIND_MAX_FORCE;
      const wind = this.effective(state, step);

      for (const body of bodies) {
        if (!body || body.isStatic || body.isSensor) continue;
        if (!(body.area > 0) || !(body.mass > 0)) continue;

        const v = body.velocity;
        let fx;
        let fy;

        if (state.drag) {
          // F = c · A · (v_viento − v_cuerpo): el cuerpo tiende a la
          // velocidad del viento y no acelera sin límite.
          fx = c * body.area * (wind.x - v.x);
          fy = c * body.area * (wind.y - v.y);
        } else {
          fx = c * body.area * wind.x;
          fy = c * body.area * wind.y;
        }

        const mag = Math.hypot(fx, fy);
        if (mag > maxForce) {
          fx = (fx / mag) * maxForce;
          fy = (fy / mag) * maxForce;
        }

        if (fx !== 0 || fy !== 0) {
          Matter.Body.applyForce(body, body.position, { x: fx, y: fy });
        }
      }
    },

    draw(state) {
      const wind = this.effective(state, state.step || 0);
      const mag = Math.hypot(wind.x, wind.y);
      if (mag < 0.03) return;

      const dir = wind.x < 0 ? -1 : 1;
      const count = Math.min(26, Math.round(6 + mag * 4));
      const span = CONFIG.WIDTH + 320;

      push();
      strokeCap(ROUND);
      for (let i = 0; i < count; i++) {
        const lane = 36 + hash01(i * 3 + 1) * (CONFIG.GROUND_Y - 76);
        const len = 12 + hash01(i * 7 + 5) * (16 + Math.min(44, mag * 7));
        const speed = 2 + hash01(i * 11 + 9) * 3 + mag * 4.5;
        const base = hash01(i * 17 + 13) * span;
        let x = (base + state.step * speed * dir) % span;
        if (x < 0) x += span;
        x -= 160;

        const wobble = Math.sin((state.step * 0.05 + i * 1.7)) * 4;
        const y = lane + wobble;
        const alpha = 22 + Math.min(90, mag * 20);

        stroke(238, 250, 255, alpha);
        strokeWeight(1.6);
        line(x - dir * len, y, x, y);

        noStroke();
        fill(238, 250, 255, alpha + 25);
        circle(x, y, 2.2);
      }
      pop();
    },

    overlay(state) {
      const wind = this.effective(state, state.step || 0);
      const mag = Math.hypot(wind.x, wind.y);
      if (mag < 0.03) return;

      const ux = wind.x / mag;
      const uy = wind.y / mag;
      const len = clampLocal(20 + mag * 10, 22, 78);

      push();
      strokeCap(ROUND);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          const x = 470 + col * 190 + (row % 2) * 30;
          const y = 150 + row * 150;
          const a = 50 + Math.min(110, mag * 16);

          stroke(190, 235, 255, a);
          strokeWeight(2);
          line(x - ux * len * 0.5, y - uy * len * 0.5,
               x + ux * len * 0.5, y + uy * len * 0.5);

          const tx = x + ux * len * 0.5;
          const ty = y + uy * len * 0.5;
          const ang = Math.atan2(uy, ux);
          noStroke();
          fill(190, 235, 255, a + 20);
          push();
          translate(tx, ty);
          rotate(ang);
          triangle(0, 0, -8, -4, -8, 4);
          pop();
        }
      }
      pop();
    },

    hud(state, x, y) {
      const wind = this.effective(state, state.step || 0);
      const mag = Math.hypot(wind.x, wind.y);
      const ms = mag * 60 / 90; // 90 px ≈ 1 m y 60 pasos ≈ 1 s

      push();
      noStroke();
      fill(10, 18, 26, 150);
      rect(x, y, 174, 32, 10);
      stroke(255, 255, 255, 22);
      strokeWeight(1);
      noFill();
      rect(x, y, 174, 32, 10);

      // veleta: flecha orientada como el viento
      push();
      translate(x + 22, y + 16);
      rotate(Math.atan2(wind.y, wind.x));

      noFill();
      stroke(255, 255, 255, 32);
      strokeWeight(1);
      circle(0, 0, 24);

      stroke(mag > 0.05 ? '#9fd9f4' : 'rgba(255,255,255,0.35)');
      strokeWeight(2);
      strokeCap(ROUND);
      line(-9, 0, 8, 0);
      noStroke();
      fill(mag > 0.05 ? '#d6f2ff' : 'rgba(255,255,255,0.35)');
      triangle(13, 0, 3, -5, 3, 5);
      pop();

      noStroke();
      useText(11, true);
      fill('#9fd9f4');
      textAlign(LEFT, CENTER);
      text(
        mag > 0.05 ? `VIENTO ${ms.toFixed(1)} m/s` : 'VIENTO EN CALMA',
        x + 46, y + 16
      );
      pop();
    }
  };

  /* ------------------------------- agua ----------------------------- */

  const waterField = {
    init(state) {
      state.baseY = num(state.y, CONFIG.GROUND_Y - 40);
      state.y = state.baseY;
      state.density = Math.max(0, num(state.density, CONFIG.FIELD_WATER_DENSITY));
      state.drag = Math.max(0, num(state.drag, CONFIG.FIELD_WATER_DRAG));
      state.rise = Math.max(0, num(state.rise, 0));
      state.riseMax = Math.max(0, num(state.riseMax, state.baseY));
      state.step = 0;
      state.inside = new WeakMap();   // fracción sumergida en el paso anterior
      state.baseAir = new WeakMap();  // frictionAir original de cada cuerpo
      state.debug = [];
    },

    /** Actualiza la cota determinista de la superficie desde el paso. */
    surfaceAt(state, step) {
      const lift = state.rise > 0
        ? Math.min(state.rise * step, state.riseMax)
        : 0;
      return state.baseY - lift;
    },

    apply(state, bodies, step, all, opts) {
      state.y = this.surfaceAt(state, step);
      state.debug.length = 0;
      const surface = state.y;
      const silent = !!(opts && opts.silent);

      for (const body of bodies) {
        if (!body || body.isStatic || body.isSensor) continue;
        if (!(body.area > 0) || !(body.mass > 0)) continue;

        const info = submergedInfo(body, surface);
        const fraction = info.fraction;
        const had = state.inside.has(body);
        const was = had ? state.inside.get(body) : fraction;

        if (fraction > 0.001) {
          // Arrastre: frictionAir efectivo proporcional a la fracción.
          if (!state.baseAir.has(body)) {
            state.baseAir.set(body, body.frictionAir);
          }
          const baseAir = state.baseAir.get(body);
          const effectiveAir = baseAir + state.drag * fraction;
          if (Math.abs(body.frictionAir - effectiveAir) > 1e-7) {
            Matter.Body.set(body, 'frictionAir', effectiveAir);
          }

          // Empuje de Arquímedes aplicado en el centroide sumergido.
          const volume = body.area * fraction;
          const buoyancy = state.density * volume * CONFIG.GRAVITY * 0.001;
          Matter.Body.applyForce(
            body,
            { x: info.cx, y: info.cy },
            { x: 0, y: -buoyancy }
          );

          // Amortiguación angular dentro del agua.
          if (Math.abs(body.angularVelocity) > 1e-6) {
            Matter.Body.setAngularVelocity(
              body,
              body.angularVelocity * (1 - CONFIG.FIELD_WATER_ANGULAR_DAMP * fraction)
            );
          }

          state.debug.push({
            body: body,
            fraction: fraction,
            x: info.cx,
            y: info.cy,
            buoyancy: buoyancy,
            weight: body.mass * CONFIG.GRAVITY * 0.001
          });

          // Chapoteo al entrar: solo una vez por entrada y con velocidad.
          const speed = Math.hypot(body.velocity.x, body.velocity.y);
          if (!silent && was <= 0.001 && fraction > 0.02 &&
              speed >= CONFIG.FIELD_SPLASH_SPEED) {
            all.events.push({
              type: 'splash',
              x: body.position.x,
              y: surface,
              strength: clampLocal((speed - CONFIG.FIELD_SPLASH_SPEED) / 18, 0.15, 1),
              body: body
            });
          }
        } else if (state.baseAir.has(body)) {
          // Al salir del agua se recupera exactamente el valor original.
          Matter.Body.set(body, 'frictionAir', state.baseAir.get(body));
          state.baseAir.delete(body);
        }

        state.inside.set(body, fraction);
      }
    },

    draw(state) {
      const surface = state.y;
      if (surface >= CONFIG.HEIGHT) return;

      const step = state.step || 0;
      push();

      // Cuerpo translúcido: tiñe lo que queda por debajo de la cota.
      noStroke();
      fill(52, 138, 199, 74);
      rect(0, surface, CONFIG.WIDTH, CONFIG.HEIGHT - surface);

      fill(28, 96, 166, 30);
      rect(0, surface + 34, CONFIG.WIDTH, CONFIG.HEIGHT - surface - 34);
      fill(18, 74, 138, 26);
      rect(0, surface + 110, CONFIG.WIDTH, CONFIG.HEIGHT - surface - 110);

      // Ondas de superficie: seno con fase dependiente del paso.
      noFill();
      for (let layer = 0; layer < 2; layer++) {
        stroke(220, 245, 255, layer === 0 ? 170 : 70);
        strokeWeight(layer === 0 ? 2.4 : 1.4);
        beginShape();
        for (let x = 0; x <= CONFIG.WIDTH; x += 16) {
          const wave =
            Math.sin(x * 0.031 + step * 0.09 + layer * 0.8) * 2.6 +
            Math.sin(x * 0.011 - step * 0.05) * 1.8;
          vertex(x, surface + wave + layer * 4);
        }
        endShape();
      }

      // Brillos horizontales profundos (procedurales, sin aleatoriedad).
      noStroke();
      for (let i = 0; i < 7; i++) {
        const y = surface + 48 + i * 26;
        const w = 120 + hash01(i * 5 + 1) * 260;
        const x = ((hash01(i * 9 + 3) * CONFIG.WIDTH + step * 0.35) % CONFIG.WIDTH) - 40;
        fill(210, 242, 255, 18);
        rect(x, y, w, 2, 2);
      }

      pop();
    },

    overlay(state) {
      const surface = state.y;
      push();

      // Cota de la superficie.
      stroke(130, 225, 255, 200);
      strokeWeight(2);
      line(0, surface, CONFIG.WIDTH, surface);
      for (let x = 24; x < CONFIG.WIDTH; x += 48) {
        line(x, surface - 5, x, surface + 5);
      }

      noStroke();
      useText(11, true);
      fill('#bdefff');
      textAlign(LEFT, BOTTOM);
      text(`AGUA · SUPERFICIE y = ${surface.toFixed(0)}`, 32, surface - 10);

      // Flechas de empuje (E) y peso (P) sobre cada cuerpo sumergido.
      useText(10, true);
      for (const item of state.debug) {
        const weight = Math.max(0.0001, item.weight);
        const ratio = item.buoyancy / weight;
        const eLen = clampLocal(16 + ratio * 22, 16, 64);
        const pLen = clampLocal(12 + item.body.mass * 2.2, 14, 54);
        const x = item.x;

        stroke(120, 235, 255, 220);
        strokeWeight(2);
        line(x, item.y, x, item.y - eLen);
        noStroke();
        fill(120, 235, 255, 235);
        triangle(x, item.y - eLen - 6, x - 5, item.y - eLen + 2, x + 5, item.y - eLen + 2);

        stroke(255, 190, 110, 220);
        strokeWeight(2);
        line(x, item.y, x, item.y + pLen);
        noStroke();
        fill(255, 190, 110, 235);
        triangle(x, item.y + pLen + 6, x - 5, item.y + pLen - 2, x + 5, item.y + pLen - 2);

        fill(180, 245, 255, 230);
        textAlign(RIGHT, CENTER);
        text(`E ${(item.fraction * 100).toFixed(0)}%`, x - 8, item.y - eLen * 0.5);
        textAlign(LEFT, CENTER);
        fill(255, 215, 170, 230);
        text('P', x + 8, item.y + pLen * 0.5);
      }

      pop();
    }
  };

  /* ---------------------------- registro ---------------------------- */

  registry.wind = windField;
  registry.water = waterField;

  /**
   * Crea el estado mutable de los campos a partir de `def.fields`.
   * Sin definición devuelve un estado vacío (Clásico intacto).
   *
   * `ctx` es opcional y solo lo usan los campos que crean cuerpos
   * (movers, poleas, láseres, térmica). En la predicción se pasa
   * `{ game, predict: true }` para consultar reactores sin duplicar
   * cuerpos ni mutar el mundo.
   */
  function create(def, ctx) {
    const state = {
      list: [],
      step: 0,
      events: [],
      game: (ctx && ctx.game) || null,
      predict: !!(ctx && ctx.predict)
    };

    if (!def || typeof def !== 'object') return state;

    for (const name of Object.keys(registry)) {
      if (!def[name]) continue;
      const fieldState = copyDefinition(def[name]);
      fieldState.step = 0;
      fieldState.name = name;
      fieldState.game = state.game;
      fieldState.predict = state.predict;
      // Los módulos empujan eventos en su propio estado; comparten el
      // array con el estado raíz para que `Fields.takeEvents` los vea.
      fieldState.events = state.events;
      // El estado se publica antes de init: un módulo puede consultar
      // otros campos o al propio juego mientras crea sus cuerpos.
      state[name] = fieldState;
      state.list.push(name);
      registry[name].init(fieldState);
    }

    return state;
  }

  function has(state) {
    return !!(state && state.list && state.list.length);
  }

  /**
   * Aplica todos los campos activos a los cuerpos dinámicos.
   * Se llama justo antes de cada Matter.Engine.update.
   */
  function apply(state, bodies, step, opts) {
    if (!has(state) || !bodies) return;
    state.step = step;

    for (const name of state.list) {
      const fieldState = state[name];
      if (!fieldState) continue;
      fieldState.step = step;
      registry[name].apply(fieldState, bodies, step, state, opts || null);
    }
  }

  /** Devuelve y vacía los eventos de simulación (chapoteos, etc.). */
  function takeEvents(state) {
    if (!state || !state.events || !state.events.length) return [];
    const events = state.events.slice();
    // Se vacía en el sitio: los estados de cada campo comparten el array.
    state.events.length = 0;
    return events;
  }

  /** Capa dibujada antes de los cuerpos (raíles, discos, halos). */
  function drawBack(state) {
    if (!has(state)) return;
    for (const name of state.list) {
      if (registry[name].drawBack) registry[name].drawBack(state[name]);
    }
  }

  /** Se llama justo después de Matter.Engine.update (posiciones finales). */
  function afterUpdate(state) {
    if (!has(state)) return;
    for (const name of state.list) {
      if (registry[name].afterUpdate) registry[name].afterUpdate(state[name]);
    }
  }

  function draw(state) {
    if (!has(state)) return;
    for (const name of state.list) {
      if (registry[name].draw) registry[name].draw(state[name]);
    }
  }

  /** Corte de cuerdas de campos (poleas) con el segmento barrido. */
  function checkCuts(state, prev, curr, info) {
    if (!has(state)) return;
    for (const name of state.list) {
      if (registry[name].checkCut) {
        registry[name].checkCut(state[name], prev, curr, info || {}, state);
      }
    }
  }

  function overlay(state) {
    if (!has(state)) return;
    for (const name of state.list) {
      if (registry[name].overlay) registry[name].overlay(state[name]);
    }
  }

  function hud(state, x, y) {
    if (!has(state)) return;
    for (const name of state.list) {
      if (registry[name].hud) registry[name].hud(state[name], x, y);
    }
  }

  return {
    registry: registry,
    scaleFields: scaleFields,
    create: create,
    has: has,
    apply: apply,
    takeEvents: takeEvents,
    drawBack: drawBack,
    afterUpdate: afterUpdate,
    draw: draw,
    checkCuts: checkCuts,
    overlay: overlay,
    hud: hud,
    submergedInfo: submergedInfo,
    clipPolygonBelow: clipPolygonBelow
  };
})();
