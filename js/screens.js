/* =====================================================================
   Resortera vs. Torre — PANTALLAS
   ---------------------------------------------------------------------
   Menú principal, selección de mundo, selección de nivel y modo Clásico.
   Todo el dibujo es procedural (p5) y toda la interacción usa las mismas
   coordenadas del lienzo que el resto del juego.

   La navegación funciona con ratón, táctil, flechas + Enter y atajos
   numéricos. `focusId` guarda el elemento enfocado para el teclado y
   `hoverId` el que está bajo el puntero.
   ===================================================================== */

const SCREEN_MENU = 'menu';
const SCREEN_WORLDS = 'worlds';
const SCREEN_LEVELS = 'levels';
const SCREEN_CLASSIC = 'classic';
const SCREEN_COMING = 'coming';
const SCREEN_HARDCORE = 'hardcore';
const SCREEN_INFINITE = 'infinite';
const SCREEN_LOADING = 'infinite-loading';

class Screens {
  constructor(game) {
    this.game = game;
    this.screen = SCREEN_MENU;
    this.world = 1;
    this.comingMode = 'hardcore';
    this.unlockAll = new URLSearchParams(window.location.search).get('unlock') === 'all';

    this.hitboxes = [];
    this.focusables = [];
    this.focusId = null;
    this.hoverId = null;
    this._hitId = 0;

    this.time = 0;
    this.notice = '';
    this.noticeTimer = 0;
    this.seedPanel = null;
    this.seedInput = null;
    this.createSeedPanel();
  }

  /* ------------------------- navegación ---------------------------- */

  setScreen(screen) {
    this.screen = screen;
    this.game.screen = screen;
    this.hitboxes = [];
    this.focusables = [];
    this.focusId = null;
    this.hoverId = null;
    this.notice = '';
    this.noticeTimer = 0;
    this.game.el.style.cursor = 'default';
    this.updateSeedPanel();
  }

  openMenu() {
    this.setScreen(SCREEN_MENU);
  }

  openWorlds() {
    const world = getCampaignWorld(this.world);
    if (world) this.game.previewTheme(world.tema);
    this.setScreen(SCREEN_WORLDS);
  }

  openWorld(world) {
    this.world = clamp(world, 1, 5);
    const data = getCampaignWorld(this.world);
    if (data) this.game.beginThemeTransition(data.tema);
    this.setScreen(SCREEN_LEVELS);
    if (!this.isWorldUnlocked(this.world)) {
      this.notify('Mundo bloqueado: completa el jefe del mundo anterior.');
    }
  }

  openClassic() {
    this.game.restoreClassicTheme();
    this.setScreen(SCREEN_CLASSIC);
  }

  openComingSoon(mode) {
    if (mode === 'infinite') this.openInfinite();
    else this.openHardcore();
  }

  openHardcore() {
    this.setScreen(SCREEN_HARDCORE);
  }

  openInfinite() {
    this.setScreen(SCREEN_INFINITE);
    if (this.seedInput && !this.seedInput.value) {
      this.seedInput.value = String(randomSeed32());
    }
  }

  createSeedPanel() {
    if (typeof document === 'undefined' || !this.game.el.parentElement) return;
    const panel = document.createElement('section');
    panel.className = 'infinite-seed-panel';
    panel.setAttribute('aria-label', 'Controles de semilla de Infinito');

    const label = document.createElement('label');
    label.textContent = 'Semilla (decimal o hexadecimal de 32 bits)';
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'text';
    input.maxLength = 10;
    input.setAttribute('aria-label', 'Semilla decimal o hexadecimal');

    const actions = document.createElement('div');
    actions.className = 'seed-actions';
    const random = this.makePanelButton('ALEATORIA', () => this.startRandomInfinite());
    const daily = this.makePanelButton('DIARIA', () => this.startDailyInfinite());
    const play = this.makePanelButton('JUGAR', () => this.startManualInfinite());
    const share = this.makePanelButton('COMPARTIR', () => this.shareInfiniteSeed());
    actions.append(random, daily, play, share);
    panel.append(label, input, actions);
    this.game.el.parentElement.appendChild(panel);
    this.seedPanel = panel;
    this.seedInput = input;
  }

  makePanelButton(label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  }

  updateSeedPanel() {
    if (!this.seedPanel) return;
    const visible = this.screen === SCREEN_INFINITE;
    this.seedPanel.style.display = visible ? 'block' : 'none';
  }

  startRandomInfinite() {
    const seed = randomSeed32();
    if (this.seedInput) this.seedInput.value = String(seed);
    this.game.startInfiniteRun(seed);
    this.updateSeedPanel();
  }

  startDailyInfinite() {
    const seed = dailySeed32();
    if (this.seedInput) this.seedInput.value = String(seed);
    this.game.startInfiniteRun(seed);
  }

  startManualInfinite() {
    const seed = parseSeed32(this.seedInput && this.seedInput.value);
    if (seed === null) {
      this.notify('La semilla debe ser un entero de 32 bits, decimal o 0xHEX.');
      if (this.seedInput) this.seedInput.focus();
      return;
    }
    this.game.startInfiniteRun(seed);
  }

  async shareInfiniteSeed() {
    const run = this.game.infiniteRun || this.game.progress.getInfiniteRun();
    const seed = run ? run.seed : parseSeed32(this.seedInput && this.seedInput.value);
    if (seed === null || seed === undefined) {
      this.notify('Introduce primero una semilla válida.');
      return;
    }
    const text = String(seed >>> 0);
    if (this.seedInput) this.seedInput.value = text;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error('clipboard unavailable');
      }
      await navigator.clipboard.writeText(text);
      this.notify(`Semilla ${text} copiada.`);
    } catch (error) {
      if (this.seedInput) {
        this.seedInput.focus();
        this.seedInput.select();
      }
      this.notify(`No se pudo copiar. Semilla visible: ${text}`, 6);
    }
  }

  startHardcore() {
    this.game.startHardcoreRun();
  }

  continueHardcore() {
    if (!this.game.continueHardcoreRun()) this.notify('No hay una run de Hardcore para continuar.');
  }

  continueInfinite() {
    if (!this.game.continueInfiniteRun()) this.notify('No hay una run de Infinito para continuar.');
  }

  back() {
    if (this.screen === SCREEN_LEVELS) {
      this.openWorlds();
      return;
    }
    if (this.screen === SCREEN_WORLDS ||
        this.screen === SCREEN_CLASSIC ||
        this.screen === SCREEN_COMING ||
        this.screen === SCREEN_HARDCORE ||
        this.screen === SCREEN_INFINITE ||
        this.screen === SCREEN_LOADING) {
      this.openMenu();
    }
  }

  notify(text, seconds = 2.6) {
    this.notice = text;
    this.noticeTimer = seconds;
  }

  /* ------------------------- estado de campaña --------------------- */

  isWorldUnlocked(world) {
    return this.unlockAll || world <= this.game.progress.data.adventure.unlockedWorld;
  }

  isLevelUnlocked(world, index) {
    if (this.unlockAll) return true;
    const adventure = this.game.progress.data.adventure;
    if (world < adventure.unlockedWorld) return true;
    if (world > adventure.unlockedWorld) return false;
    return index <= adventure.unlockedLevel;
  }

  playClassic(index) {
    this.game.startClassic(index);
  }

  playCampaign(world, index) {
    if (!this.isWorldUnlocked(world)) {
      this.notify('Completa el jefe del mundo anterior para desbloquearlo.');
      return;
    }

    if (!this.isLevelUnlocked(world, index)) {
      this.notify('Completa el nivel anterior para poder jugar este.');
      return;
    }

    const def = getCampaignLevel(world, index);
    if (!def || (!def.ready && !this.unlockAll)) {
      this.notify('Nivel en preparación. Llegará en la siguiente fase.');
      return;
    }

    this.game.startCampaignLevel(def.ready ? def : Object.assign({}, def, { ready: true }));
  }

  /* --------------------------- entrada ----------------------------- */

  pointerDown(p) {
    const hit = this.hitTest(p);
    if (!hit) return;
    this.focusId = hit.id;
    this.activate(hit);
  }

  pointerMove(p) {
    const hit = this.hitTest(p);
    this.hoverId = hit ? hit.id : null;
    if (hit) this.focusId = hit.id;
    if (this.screen === SCREEN_WORLDS && hit && hit.theme) {
      this.game.previewTheme(hit.theme);
    }
    this.game.el.style.cursor = hit ? 'pointer' : 'default';
  }

  pointerUp() {
    /* Los botones se activan al pulsar; no hace falta esperar al soltar. */
  }

  keyPressed(k, keyCode) {
    if (keyCode === 27 || k === 'escape') {
      this.back();
      return;
    }

    if (keyCode === 37) { this.moveFocus(-1, 0); this.previewFocusedTheme(); return; }
    if (keyCode === 39) { this.moveFocus(1, 0); this.previewFocusedTheme(); return; }
    if (keyCode === 38) { this.moveFocus(0, -1); this.previewFocusedTheme(); return; }
    if (keyCode === 40) { this.moveFocus(0, 1); this.previewFocusedTheme(); return; }

    if (keyCode === 13 || keyCode === 32 || k === 'enter' || k === ' ') {
      this.activateFocused();
      return;
    }

    // Atajos: 1-9 para tarjetas/niveles y C para continuar.
    if ((k >= '0' && k <= '9') || k === 'c') {
      const hit = this.focusables.find((item) => item.shortcut === k);
      if (hit) {
        this.activate(hit);
        return;
      }
    }
  }

  hitTest(p) {
    for (let i = this.hitboxes.length - 1; i >= 0; i--) {
      const hit = this.hitboxes[i];
      if (p.x >= hit.x && p.x <= hit.x + hit.w &&
          p.y >= hit.y && p.y <= hit.y + hit.h) {
        return hit;
      }
    }
    return null;
  }

  addHitbox(x, y, w, h, action, opts = {}) {
    const hit = {
      id: `hit-${this._hitId++}`,
      x: x,
      y: y,
      w: w,
      h: h,
      action: action,
      shortcut: opts.shortcut || null,
      theme: opts.theme || null,
      disabled: !!opts.disabled
    };
    this.hitboxes.push(hit);
    return hit;
  }

  activate(hit) {
    if (hit && typeof hit.action === 'function') hit.action();
  }

  activateFocused() {
    const hit = this.focusables.find((item) => item.id === this.focusId);
    if (hit) this.activate(hit);
  }

  moveFocus(dx, dy) {
    if (!this.focusables.length) return;

    const current = this.focusables.find((item) => item.id === this.focusId) ||
      this.focusables[0];
    const cx = current.x + current.w / 2;
    const cy = current.y + current.h / 2;

    const candidates = this.focusables
      .filter((item) => item !== current)
      .filter((item) => {
        const x = item.x + item.w / 2;
        const y = item.y + item.h / 2;
        if (dx > 0) return x > cx + 4;
        if (dx < 0) return x < cx - 4;
        if (dy > 0) return y > cy + 4;
        if (dy < 0) return y < cy - 4;
        return false;
      })
      .map((item) => {
        const x = item.x + item.w / 2;
        const y = item.y + item.h / 2;
        const primary = dx !== 0 ? Math.abs(x - cx) : Math.abs(y - cy);
        const secondary = dx !== 0 ? Math.abs(y - cy) : Math.abs(x - cx);
        return { item: item, distance: primary + secondary * 2.2 };
      })
      .sort((a, b) => a.distance - b.distance);

    if (candidates.length) this.focusId = candidates[0].item.id;
  }

  previewFocusedTheme() {
    if (this.screen !== SCREEN_WORLDS) return;
    const hit = this.focusables.find((item) => item.id === this.focusId);
    if (hit && hit.theme) this.game.previewTheme(hit.theme);
  }

  /* --------------------------- update/render ----------------------- */

  update(dt) {
    this.time += dt;
    if (this.noticeTimer > 0) this.noticeTimer -= dt;
  }

  render() {
    this._hitId = 0;
    this.hitboxes = [];

    if (this.screen === SCREEN_WORLDS) this.renderWorlds();
    else if (this.screen === SCREEN_LEVELS) this.renderLevels();
    else if (this.screen === SCREEN_CLASSIC) this.renderClassic();
    else if (this.screen === SCREEN_COMING) this.renderComingSoon();
    else if (this.screen === SCREEN_HARDCORE) this.renderHardcore();
    else if (this.screen === SCREEN_INFINITE) this.renderInfinite();
    else if (this.screen === SCREEN_LOADING) this.renderLoading();
    else this.renderMenu();

    this.focusables = this.hitboxes.filter((item) => !item.disabled);
    if (!this.focusableExists(this.focusId)) {
      // Al entrar en una pantalla, el foco empieza en el primer contenido
      // útil, no en el botón de volver.
      const preferred = this.focusables.find((item) => item.shortcut !== 'escape') ||
        this.focusables[0];
      this.focusId = preferred ? preferred.id : null;
    }

    this.renderNotice();
  }

  focusableExists(id) {
    if (!id) return false;
    return this.focusables.some((item) => item.id === id);
  }

  /* ----------------------------- menú ------------------------------ */

  renderMenu() {
    const W = this.game.W;
    const H = this.game.H;

    noStroke();
    fill(6, 10, 16, 155);
    rect(0, 0, W, H);

    textAlign(CENTER, TOP);
    useText(12.5, true);
    fill('#ffd166');
    text('JUEGO DE FÍSICA  ·  REACCIÓN EN CADENA', W / 2, 42);

    useText(60, true);
    fill(0, 0, 0, 110);
    text('RESORTERA VS. TORRE', W / 2 + 3, 76 + 3);
    fill('#ffffff');
    text('RESORTERA VS. TORRE', W / 2, 76);

    useText(16, false);
    fill('#cfe4f2');
    text('Apunta, suelta y derriba. Cinco mundos te esperan.', W / 2, 148);

    // Continuar una partida que se dejó a medias con Esc.
    if (this.game.canResume()) {
      const resume = this.addHitbox(W - 250, 24, 210, 44, () => this.game.resumeGame(), {
        shortcut: 'c'
      });
      this.drawButton(resume, 'CONTINUAR  ›', {
        color: '#2f8f4a',
        size: 14
      });
    }

    const modes = [
      {
        id: 'adventure',
        title: 'AVENTURA',
        subtitle: '5 mundos · 60 niveles\nEstrellas y jefes por mundo.',
        badge: 'MUNDO 1 COMPLETO · 12 NIVELES',
        color: '#7fb257',
        accent: '#ffd166',
        icon: 'stars',
        action: () => this.openWorlds(),
        shortcut: '1'
      },
      {
        id: 'hardcore',
        title: 'HARDCORE',
        subtitle: 'La aventura completa\ncon una sola vida.',
        badge: 'UNA VIDA · 60 NIVELES',
        color: '#d96b4a',
        accent: '#ffc08a',
        icon: 'heart',
        action: () => this.openHardcore(),
        shortcut: '2'
      },
      {
        id: 'infinite',
        title: 'INFINITO',
        subtitle: 'Semillas de 32 bits\nniveles sin final.',
        badge: 'SEMILLA · RANKING · MUTADORES',
        color: '#7f8ed9',
        accent: '#d8dcff',
        icon: 'infinity',
        action: () => this.openInfinite(),
        shortcut: '3'
      }
    ];

    const cardW = 350;
    const cardH = 230;
    const gap = 22;
    const totalW = modes.length * cardW + (modes.length - 1) * gap;
    const startX = (W - totalW) / 2;
    const cardY = 220;

    for (let i = 0; i < modes.length; i++) {
      const hit = this.addHitbox(
        startX + i * (cardW + gap), cardY, cardW, cardH,
        modes[i].action, { shortcut: modes[i].shortcut }
      );
      this.drawModeCard(hit, modes[i]);
    }

    const classic = this.addHitbox(W / 2 - 190, 486, 380, 52, () => this.openClassic(), {
      shortcut: '4'
    });
    this.drawButton(classic, 'MODO CLÁSICO  ·  6 NIVELES', {
      color: '#3b4d63',
      size: 16
    });

    const adventureStars = this.game.progress.getTotalStars('adventure');
    const classicStars = this.game.progress.getTotalStars('classic');

    textAlign(CENTER, TOP);
    useText(14, true);
    fill('#ffd166');
    text(`★ ${adventureStars}/300 AVENTURA     ·     ★ ${classicStars}/30 CLÁSICO`, W / 2, 566);

    useText(12.5, false);
    fill(255, 255, 255, 155);
    text('Ratón o táctil  ·  Flechas + Enter  ·  Esc volver  ·  M sonido', W / 2, 604);
    text('Los corazones dan un tiro extra. Las estrellas premian la precisión.', W / 2, 628);
  }

  drawModeCard(hit, mode) {
    const active = this.isActive(hit);
    const cx = hit.x + hit.w / 2;

    this.drawCardBase(hit, mode.color, active);

    noStroke();
    fill(this.uiColor(mode.color, 34));
    circle(cx, hit.y + 52, 78);

    if (mode.icon === 'stars') {
      this.game.drawStarsRow(cx, hit.y + 52, 3, 3, 14);
    } else if (mode.icon === 'heart') {
      this.drawHeart(cx, hit.y + 50, 40, mode.accent);
    } else {
      this.drawInfinity(cx, hit.y + 52, 46, mode.accent);
    }

    textAlign(CENTER, TOP);
    useText(28, true);
    fill('#ffffff');
    text(mode.title, cx, hit.y + 96);

    useText(13, false);
    fill('#cfe4f2');
    text(mode.subtitle, cx, hit.y + 134);

    const badgeW = Math.max(150, textWidth(mode.badge) + 40);
    noStroke();
    fill(this.uiColor(mode.color, 45));
    rect(cx - badgeW / 2, hit.y + 186, badgeW, 27, 13);
    useText(10.5, true);
    fill(mode.accent);
    text(mode.badge, cx, hit.y + 193);
  }

  /* --------------------------- mundos ------------------------------ */

  renderWorlds() {
    const W = this.game.W;
    const H = this.game.H;

    noStroke();
    fill(6, 10, 16, 158);
    rect(0, 0, W, H);

    this.drawBackButton();
    this.drawTitle('AVENTURA', 'Elige un mundo y avanza hasta su jefe.');

    const cardW = 210;
    const cardH = 330;
    const gap = 18;
    const totalW = CAMPAIGN_WORLDS.length * cardW + (CAMPAIGN_WORLDS.length - 1) * gap;
    const startX = (W - totalW) / 2;
    const cardY = 206;

    for (let i = 0; i < CAMPAIGN_WORLDS.length; i++) {
      const world = CAMPAIGN_WORLDS[i];
      const hit = this.addHitbox(
        startX + i * (cardW + gap), cardY, cardW, cardH,
        () => this.openWorld(world.id), { shortcut: String(world.id), theme: world.tema }
      );
      this.drawWorldCard(hit, world);
    }

    textAlign(CENTER, BOTTOM);
    useText(13, false);
    fill(255, 255, 255, 160);
    text('Completa el jefe de un mundo para desbloquear el siguiente.', W / 2, H - 42);

    this.drawFooterHint('★ Las estrellas de cada mundo se consiguen superando sus 12 niveles.');
  }

  drawWorldCard(hit, world) {
    const active = this.isActive(hit);
    const unlocked = this.isWorldUnlocked(world.id);
    const stars = this.game.progress.getWorldStars(world.id);
    const cx = hit.x + hit.w / 2;

    this.drawCardBase(hit, world.color, active);

    noStroke();
    fill(this.uiColor(world.color, 26));
    rect(hit.x + 2, hit.y + 8, hit.w - 4, hit.h - 10, 15);

    this.drawThemeThumbnail(hit.x + 12, hit.y + 28, hit.w - 24, 86, world.tema);

    textAlign(LEFT, TOP);
    useText(54, true);
    fill(255, 255, 255, 26);
    text(nf(world.id, 2), hit.x + 14, hit.y + 14);

    if (!unlocked) this.drawLock(hit.x + hit.w - 32, hit.y + 38, 22, this.uiColor('#ffffff', 150));

    textAlign(CENTER, TOP);
    useText(19, true);
    fill('#ffffff');
    text(world.nombre.toUpperCase(), cx, hit.y + 120);

    useText(10.5, true);
    fill(world.accent);
    text(world.subtitle.toUpperCase(), cx, hit.y + 145);

    useText(10.5, false);
    fill('#cfe4f2');
    text(world.descripcion, hit.x + 15, hit.y + 165, hit.w - 30, 38);

    const mechanics = world.mecanicas.slice(0, 9);
    const iconGap = 19;
    const iconStart = cx - ((mechanics.length - 1) * iconGap) / 2;
    for (let i = 0; i < mechanics.length; i++) {
      this.drawMechanicIcon(iconStart + i * iconGap, hit.y + 224, mechanics[i], world.accent, 15);
    }

    useText(14, true);
    fill(world.accent);
    text(`★ ${stars}/60`, cx, hit.y + 250);

    const label = unlocked ? (world.id === 1 ? 'JUGAR' : 'VER NIVELES') : 'BLOQUEADO';
    const badgeW = 126;
    noStroke();
    fill(unlocked ? this.uiColor(world.color, 60) : this.uiColor('#0b1119', 170));
    rect(cx - badgeW / 2, hit.y + 282, badgeW, 26, 12);
    useText(10.5, true);
    fill(unlocked ? '#ffffff' : '#9fb0c0');
    text(label, cx, hit.y + 288);
  }

  /* --------------------------- niveles ----------------------------- */

  renderLevels() {
    const W = this.game.W;
    const H = this.game.H;
    const world = getCampaignWorld(this.world) || CAMPAIGN_WORLDS[0];
    const stars = this.game.progress.getWorldStars(world.id);

    noStroke();
    fill(6, 10, 16, 162);
    rect(0, 0, W, H);

    this.drawBackButton();
    this.drawTitle(
      `MUNDO ${world.id} · ${world.name.toUpperCase()}`,
      this.isWorldUnlocked(world.id)
        ? world.description
        : 'Mundo bloqueado: completa el jefe del mundo anterior.'
    );

    textAlign(RIGHT, TOP);
    useText(15, true);
    fill('#ffd166');
    text(`★ ${stars}/60`, W - 42, 44);

    const cardW = 258;
    const cardH = 122;
    const gap = 16;
    const totalW = 4 * cardW + 3 * gap;
    const startX = (W - totalW) / 2;
    const startY = 188;

    for (let i = 1; i <= 12; i++) {
      const def = getCampaignLevel(world.id, i);
      const col = (i - 1) % 4;
      const row = Math.floor((i - 1) / 4);
      const hit = this.addHitbox(
        startX + col * (cardW + gap),
        startY + row * (cardH + 14),
        cardW, cardH,
        () => this.playCampaign(world.id, i),
        { shortcut: i <= 9 ? String(i) : null }
      );
      this.drawLevelCard(hit, world, def, i);
    }

    textAlign(CENTER, BOTTOM);
    useText(13, false);
    fill(255, 255, 255, 160);
    text(
      this.isWorldUnlocked(world.id)
        ? 'Completa cada nivel para desbloquear el siguiente. El nivel 12 es el jefe.'
        : 'Puedes ver los niveles, pero no jugarlos hasta superar el mundo anterior.',
      W / 2, H - 42
    );

    this.drawFooterHint('★ Las estrellas dependen de los tiros que uses: menos tiros, más estrellas.');
  }

  drawLevelCard(hit, world, def, index) {
    const active = this.isActive(hit);
    const unlocked = this.isLevelUnlocked(world.id, index);
    const ready = !!(def && def.ready);
    const stars = def ? this.game.progress.getStars('adventure', def.id) : 0;
    const cx = hit.x + hit.w / 2;
    const accent = ready && unlocked ? world.accent : '#5a6a7c';

    this.drawCardBase(hit, accent, active);

    // Número y etiqueta de jefe.
    textAlign(LEFT, TOP);
    useText(23, true);
    fill(unlocked ? '#ffffff' : '#7d8fa3');
    text(nf(index, 2), hit.x + 12, hit.y + 10);

    if (index === 12) {
      const bossW = 46;
      noStroke();
      fill(this.uiColor('#e0796c', 55));
      rect(hit.x + hit.w - bossW - 10, hit.y + 10, bossW, 19, 8);
      useText(8.5, true);
      fill('#ffb0a5');
      textAlign(CENTER, TOP);
      text('JEFE', hit.x + hit.w - bossW / 2 - 10, hit.y + 14);
    } else if (!unlocked) {
      this.drawLock(hit.x + hit.w - 26, hit.y + 24, 17, this.uiColor('#ffffff', 110));
    }

    textAlign(LEFT, TOP);
    useText(13, true);
    fill(unlocked ? '#dcecf7' : '#718396');
    text(def ? def.name.toUpperCase() : `NIVEL ${index}`, hit.x + 48, hit.y + 14, hit.w - 60, 34);

    useText(10.5, false);
    fill(active ? world.accent : '#a8bac8');
    const concept = def && def.concepto ? def.concepto : 'Concepto por definir.';
    text(concept, hit.x + 12, hit.y + 55, hit.w - 24, 29);

    this.game.drawStarsRow(cx, hit.y + 91, stars, 5, 6);

    const label = !unlocked
      ? 'BLOQUEADO'
      : (!ready ? 'EN PREPARACIÓN' : (stars > 0 ? 'COMPLETADO' : 'JUGAR'));

    const labelColor = !unlocked || !ready ? '#9fb0c0' : '#ffffff';
    noStroke();
    fill(!unlocked || !ready ? this.uiColor('#0b1119', 160) : this.uiColor(accent, 65));
    rect(hit.x + 10, hit.y + 104, hit.w - 20, 15, 7);
    useText(9.5, true);
    fill(labelColor);
    textAlign(CENTER, TOP);
    text(label, cx, hit.y + 106);
  }

  /* --------------------------- clásico ----------------------------- */

  renderClassic() {
    const W = this.game.W;
    const H = this.game.H;

    noStroke();
    fill(6, 10, 16, 158);
    rect(0, 0, W, H);

    this.drawBackButton();
    this.drawTitle('MODO CLÁSICO', 'Los 6 niveles originales de la primera versión.');

    const stars = this.game.progress.getTotalStars('classic');
    textAlign(RIGHT, TOP);
    useText(15, true);
    fill('#ffd166');
    text(`★ ${stars}/30`, W - 42, 44);

    const cardW = 330;
    const cardH = 156;
    const gapX = 20;
    const gapY = 18;
    const totalW = 3 * cardW + 2 * gapX;
    const startX = (W - totalW) / 2;
    const startY = 242;

    for (let i = 0; i < LEVELS.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const hit = this.addHitbox(
        startX + col * (cardW + gapX),
        startY + row * (cardH + gapY),
        cardW, cardH,
        () => this.playClassic(i),
        { shortcut: String(i + 1) }
      );
      this.drawClassicCard(hit, i);
    }

    textAlign(CENTER, BOTTOM);
    useText(13, false);
    fill(255, 255, 255, 160);
    text('Los récords y las estrellas de cada nivel se guardan por separado.', W / 2, H - 42);

    this.drawFooterHint('★ Modo clásico: el par es un tiro menos que los tiros disponibles.');
  }

  drawClassicCard(hit, index) {
    const active = this.isActive(hit);
    const level = LEVELS[index];
    const id = level.id || `classic-${index + 1}`;
    const stars = this.game.progress.getStars('classic', id);
    const cx = hit.x + hit.w / 2;

    this.drawCardBase(hit, '#d9a441', active);

    textAlign(LEFT, TOP);
    useText(25, true);
    fill('#ffffff');
    text(nf(index + 1, 2), hit.x + 14, hit.y + 14);

    useText(18, true);
    fill('#ffffff');
    text(level.name.toUpperCase(), hit.x + 62, hit.y + 18);

    useText(11.5, false);
    fill('#cfe4f2');
    text(
      `${level.shots} TIROS  ·  PAR ${level.par || Math.max(1, level.shots - 1)}`,
      hit.x + 62, hit.y + 44
    );

    this.game.drawStarsRow(cx, hit.y + 92, stars, 5, 9);

    const label = stars > 0 ? 'COMPLETADO  ·  JUGAR' : 'JUGAR';
    noStroke();
    fill(this.uiColor('#d9a441', 55));
    rect(hit.x + 14, hit.y + 116, hit.w - 28, 24, 10);
    useText(10.5, true);
    fill('#ffe0a3');
    textAlign(CENTER, TOP);
    text(label, cx, hit.y + 121);
  }

  renderHardcore() {
    const W = this.game.W;
    const data = this.game.progress.data.hardcore;
    const current = data.currentRun;
    const best = data.bestRun;

    noStroke();
    fill(6, 10, 16, 166);
    rect(0, 0, W, this.game.H);
    this.drawBackButton();
    this.drawTitle('MODO HARDCORE', 'Una vida para superar la campaña completa.');

    this.drawHeart(W / 2, 190, 56, '#e0796c');
    textAlign(CENTER, TOP);
    useText(16, true);
    fill('#ffc08a');
    text('60 NIVELES · 3 ESTRELLAS MÍNIMO · SIN REINTENTOS', W / 2, 240);
    useText(14, false);
    fill('#dcecf7');
    text(
      best
        ? `MEJOR RUN · ${best.levels}/60 niveles · ${best.score} puntos · ${best.stars} estrellas`
        : `MEJOR RUN · ${data.bestWorld}-${data.bestLevel} · ${data.bestScore} puntos`,
      W / 2, 275
    );
    if (current) {
      fill('#9fc4dc');
      text(
        `CONTINUAR · mundo ${current.world}, nivel ${current.level} · ` +
        `${current.levels}/60 superados · ${current.score} puntos`,
        W / 2, 304
      );
    }
    if (this.game.hardcoreResult) {
      const status = this.game.hardcoreFailure === 'stars'
        ? 'Run terminada: hacen falta al menos 3 estrellas por nivel.'
        : (this.game.hardcoreRun && this.game.hardcoreRun.levels >= 60
          ? '¡Campaña completada!'
          : 'Run terminada.');
      fill('#ffb0a5');
      text(status, W / 2, 334);
    }

    const buttonY = 390;
    const fresh = this.addHitbox(W / 2 - 240, buttonY, 220, 54,
      () => this.startHardcore());
    this.drawButton(fresh, 'NUEVA PARTIDA', { color: '#a7443b', size: 15 });
    const resume = this.addHitbox(W / 2 + 20, buttonY, 220, 54,
      () => this.continueHardcore(), { disabled: !current, shortcut: 'c' });
    this.drawButton(resume, 'CONTINUAR', {
      color: current ? '#2f6b48' : '#26384a',
      size: 15
    });

    useText(12, false);
    fill(255, 255, 255, 150);
    text('Al cerrar la pestaña a mitad de nivel, ese nivel se reinicia al continuar.', W / 2, 475);

    const history = data.history || [];
    if (history.length) {
      useText(11, true);
      fill('#ffd166');
      text('ÚLTIMAS RUNS', W / 2, 502);
      useText(11, false);
      fill('#dcecf7');
      for (let i = 0; i < Math.min(5, history.length); i++) {
        const item = history[i];
        text(
          `${item.levels}/60 niveles · ${item.score} puntos · ${item.date || 'sin fecha'}`,
          W / 2, 522 + i * 20
        );
      }
    }

    this.drawFooterHint('R no reinicia el nivel. Los corazones dan un tiro extra solo dentro de su nivel.');
  }

  renderInfinite() {
    const W = this.game.W;
    const current = this.game.progress.getInfiniteRun();
    const rows = this.game.progress.getLeaderboard();
    const seed = parseSeed32(this.seedInput && this.seedInput.value);
    const bySeed = seed === null ? [] : this.game.progress.getLeaderboard(seed);

    noStroke();
    fill(6, 10, 16, 166);
    rect(0, 0, W, this.game.H);
    this.drawBackButton();
    this.drawTitle('MODO INFINITO', 'Semillas reproducibles, niveles validados y una racha sin límite.');

    textAlign(CENTER, TOP);
    useText(13, false);
    fill('#dcecf7');
    text(
      current
        ? `PARTIDA GUARDADA · semilla ${current.seed} · nivel ${current.depth} · ${current.score} puntos`
        : 'La semilla diaria se calcula con la fecha local AAAA-MM-DD.',
      W / 2, 126
    );
    if (this.game.infiniteLastRun) {
      const run = this.game.infiniteLastRun;
      fill('#ffd166');
      text(
        `ÚLTIMA RACHA · ${run.depth} niveles · ${run.score} puntos · ${run.stars} estrellas`,
        W / 2, 146
      );
    }
    const continueRun = this.addHitbox(W / 2 - 130, 180, 260, 42,
      () => this.continueInfinite(), { disabled: !current, shortcut: 'c' });
    this.drawButton(continueRun, 'CONTINUAR', {
      color: current ? '#2f6b48' : '#26384a',
      size: 14
    });

    const tableTop = 245;
    useText(14, true);
    fill('#d8dcff');
    text('TOP 10 GLOBAL', W / 2 - 200, tableTop);
    text('TOP 10 DE LA SEMILLA', W / 2 + 190, tableTop);
    useText(11.5, false);
    fill('#dcecf7');
    for (let i = 0; i < 10; i++) {
      const global = rows[i];
      const scoped = bySeed[i];
      if (global) {
        text(
          `${i + 1}. ${global.depth} niveles · ${global.score} pts · ${global.seed}`,
          W / 2 - 200, tableTop + 26 + i * 22
        );
      }
      if (scoped) {
        text(
          `${i + 1}. ${scoped.depth} niveles · ${scoped.score} pts · ${scoped.date}`,
          W / 2 + 190, tableTop + 26 + i * 22
        );
      }
    }
    this.drawFooterHint('Aleatoria, diaria o manual. Compartir copia el número de semilla.');
  }

  renderLoading() {
    noStroke();
    fill(6, 10, 16, 185);
    rect(0, 0, this.game.W, this.game.H);
    this.drawTitle('VALIDANDO NIVEL', 'La simulación headless está comprobando la estructura y la ventana de gracia.');
    useText(16, true);
    fill('#d8dcff');
    textAlign(CENTER, CENTER);
    text(
      this.game.infiniteRun
        ? `SEMILLA ${this.game.infiniteRun.seed} · NIVEL ${this.game.infiniteRun.depth}`
        : 'Preparando la partida…',
      this.game.W / 2, this.game.H / 2
    );
  }

  /* ------------------------ próximamente --------------------------- */

  renderComingSoon() {
    const W = this.game.W;
    const H = this.game.H;
    const isInfinite = this.comingMode === 'infinite';

    const data = isInfinite
      ? {
        title: 'MODO INFINITO',
        subtitle: 'Una semilla. Niveles sin final.',
        color: '#7f8ed9',
        accent: '#d8dcff',
        icon: 'infinity',
        lines: [
          'Semillas de 32 bits: 4.294.967.296 partidas posibles.',
          'El mismo número genera siempre los mismos niveles.',
          'Si pierdes, vuelves al nivel 1 y tu marca entra en el ranking.',
          'La tabla guarda la semilla, el nivel alcanzado y los puntos.'
        ]
      }
      : {
        title: 'MODO HARDCORE',
        subtitle: 'Una sola vida. Sin red de seguridad.',
        color: '#d96b4a',
        accent: '#ffc08a',
        icon: 'heart',
        lines: [
          'La misma aventura de 60 niveles, sin reintentos de nivel.',
          'Si fallas un nivel, la run termina y vuelves al 1-1.',
          'Los corazones dan un tiro extra, pero no pasan al siguiente nivel.',
          'Se guarda tu mejor run, el checkpoint y las últimas diez runs.'
        ]
      };

    noStroke();
    fill(6, 10, 16, 170);
    rect(0, 0, W, H);

    this.drawBackButton();
    this.drawTitle(data.title, data.subtitle);

    const cx = W / 2;
    noStroke();
    fill(this.uiColor(data.color, 35));
    circle(cx, 232, 150);

    if (data.icon === 'heart') {
      this.drawHeart(cx, 226, 76, data.accent);
    } else {
      this.drawInfinity(cx, 232, 86, data.accent);
    }

    const badgeW = 190;
    noStroke();
    fill(this.uiColor(data.color, 55));
    rect(cx - badgeW / 2, 318, badgeW, 28, 13);
    useText(11, true);
    fill(data.accent);
    textAlign(CENTER, TOP);
    text('PRÓXIMAMENTE', cx, 326);

    textAlign(LEFT, TOP);
    useText(14.5, false);
    fill('#dcecf7');
    let listW = 0;
    for (const line of data.lines) {
      listW = Math.max(listW, textWidth(`•  ${line}`));
    }
    const listX = cx - listW / 2;
    for (let i = 0; i < data.lines.length; i++) {
      text(`•  ${data.lines[i]}`, listX, 372 + i * 26);
    }

    const back = this.addHitbox(cx - 320, 520, 200, 52, () => this.openMenu(), {
      shortcut: '1'
    });
    this.drawButton(back, '‹  VOLVER', { color: '#26384a', size: 15 });

    const adventure = this.addHitbox(cx - 100, 520, 200, 52, () => this.openWorlds(), {
      shortcut: '2'
    });
    this.drawButton(adventure, 'AVENTURA', { color: '#2f6b48', size: 15 });

    const classic = this.addHitbox(cx + 120, 520, 200, 52, () => this.openClassic(), {
      shortcut: '3'
    });
    this.drawButton(classic, 'CLÁSICO', { color: '#3b4d63', size: 15 });

    this.drawFooterHint('Este modo se activará en una próxima actualización.');
  }

  /* ----------------------- piezas de dibujo ------------------------ */

  drawThemeThumbnail(x, y, w, h, themeId) {
    const theme = getTheme(themeId);
    const t = this.time * 0.12;
    push();
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(x, y, w, h);
    drawingContext.clip();
    noStroke();
    for (let i = 0; i < 10; i++) {
      const ratio = i / 9;
      fill(lerpColor(color(theme.palette.skyTop), color(theme.palette.skyBottom), ratio));
      rect(x, y + h * ratio, w, h / 9 + 1);
    }

    if (theme.id === 'meadow') {
      fill('#a6c78b');
      ellipse(x + w * 0.24, y + h * 0.83, w * 0.78, h * 0.7);
      ellipse(x + w * 0.82, y + h * 0.88, w * 0.88, h * 0.72);
      fill('#67935b');
      ellipse(x + w * 0.08, y + h, w * 0.82, h * 0.5);
      ellipse(x + w * 0.67, y + h, w, h * 0.58);
      fill('#ffe8b2');
      circle(x + w * 0.78, y + h * 0.27, 18);
    } else if (theme.id === 'canyon') {
      fill('#b97146');
      beginShape();
      vertex(x, y + h * 0.72); vertex(x + w * 0.15, y + h * 0.48);
      vertex(x + w * 0.31, y + h * 0.48); vertex(x + w * 0.39, y + h * 0.62);
      vertex(x + w * 0.55, y + h * 0.62); vertex(x + w * 0.68, y + h * 0.35);
      vertex(x + w * 0.84, y + h * 0.35); vertex(x + w, y + h * 0.65);
      vertex(x + w, y + h); vertex(x, y + h); endShape(CLOSE);
      fill('#e6a660');
      rect(x, y + h * 0.83, w, h * 0.17);
    } else if (theme.id === 'reef') {
      fill('#2b8490');
      rect(x, y + h * 0.58, w, h * 0.42);
      fill('#83c7aa');
      ellipse(x + w * 0.2, y + h * 0.65, w * 0.5, h * 0.32);
      ellipse(x + w * 0.82, y + h * 0.62, w * 0.48, h * 0.3);
      stroke('#d1fff1');
      strokeWeight(1.5);
      noFill();
      for (let row = 0; row < 3; row++) {
        beginShape();
        for (let px = 0; px <= w; px += 12) {
          vertex(x + px, y + h * (0.65 + row * 0.12) + Math.sin(px * 0.05 + t + row) * 2);
        }
        endShape();
      }
    } else if (theme.id === 'factory') {
      fill('#454c50');
      rect(x, y + h * 0.48, w * 0.23, h * 0.52);
      rect(x + w * 0.27, y + h * 0.31, w * 0.28, h * 0.69);
      rect(x + w * 0.6, y + h * 0.54, w * 0.4, h * 0.46);
      fill('#d28a5b');
      for (let i = 0; i < 5; i++) rect(x + w * (0.32 + i * 0.045), y + h * 0.4, 4, 4);
      noFill();
      stroke('#bd9274');
      strokeWeight(2);
      circle(x + w * 0.78, y + h * 0.37, 25);
      circle(x + w * 0.78, y + h * 0.37, 12);
      line(x + w * 0.78, y + h * 0.24, x + w * 0.78, y + h * 0.5);
      line(x + w * 0.65, y + h * 0.37, x + w * 0.91, y + h * 0.37);
    } else {
      fill(100, 83, 130, 65);
      ellipse(x + w * 0.35, y + h * 0.5, w * 0.72, h * 0.88);
      fill('#b29dcc');
      circle(x + w * 0.73, y + h * 0.45, h * 0.7);
      fill('#6b5f83');
      circle(x + w * 0.76, y + h * 0.4, h * 0.62);
      fill('#ffffff');
      for (let i = 0; i < 16; i++) {
        const sx = x + ((i * 47) % Math.max(1, w));
        const sy = y + ((i * 29) % Math.max(1, h * 0.7));
        circle(sx, sy, 1 + (i % 3) * 0.45);
      }
    }

    noStroke();
    fill(255, 255, 255, 42);
    for (let i = 0; i < 7; i++) {
      const px = x + ((i * 43 + t * (6 + i)) % w);
      const py = y + h * (0.24 + (i % 4) * 0.14);
      circle(px, py, theme.particles.kind === 'steam' ? 5 + (i % 3) : 2.5);
    }
    noFill();
    stroke(255, 255, 255, 95);
    strokeWeight(1);
    rect(x, y, w, h, 8);
    drawingContext.restore();
    pop();
  }

  drawMechanicIcon(x, y, mechanic, accent, size) {
    const r = size / 2;
    push();
    noFill();
    stroke(accent);
    strokeWeight(1.5);
    if (mechanic === 'wind') {
      line(x - r, y - 3, x + r, y - 3); line(x - r * 0.6, y + 2, x + r, y + 2);
    } else if (mechanic === 'water') {
      arc(x, y - 1, size, size * 0.55, 0, PI); arc(x, y + 3, size, size * 0.55, 0, PI);
    } else if (mechanic === 'glass') {
      quad(x, y - r, x + r, y, x, y + r, x - r, y);
    } else if (mechanic === 'stone' || mechanic === 'shield') {
      rect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4, 2);
    } else if (mechanic === 'rope') {
      bezier(x, y - r, x - r * 0.4, y - 2, x + r * 0.4, y + 2, x, y + r);
    } else if (mechanic === 'lever') {
      line(x - r, y - 2, x + r, y - 2); triangle(x - 3, y + r, x + 3, y + r, x, y + 1);
    } else if (mechanic === 'domino') {
      rect(x - r + 1, y - r, r * 0.65, size, 1); rect(x + 2, y - r, r * 0.65, size, 1);
    } else if (mechanic === 'heart') {
      arc(x - 3, y - 1, 8, 8, PI, TWO_PI); arc(x + 3, y - 1, 8, 8, PI, TWO_PI);
      line(x - 7, y, x, y + 7); line(x + 7, y, x, y + 7);
    } else if (mechanic === 'boss') {
      circle(x, y, size * 0.65); line(x - r, y, x + r, y); line(x, y - r, x, y + r);
    } else if (mechanic === 'magnet') {
      arc(x, y, size * 0.85, size * 0.85, 0, PI); line(x - r * 0.43, y, x - r * 0.43, y - 3); line(x + r * 0.43, y, x + r * 0.43, y - 3);
    } else if (mechanic === 'thermal' || mechanic === 'fire') {
      triangle(x, y - r, x + r * 0.7, y + r, x - r * 0.7, y + r);
    } else if (mechanic === 'gravity' || mechanic === 'wells') {
      circle(x, y, size * 0.7); line(x, y - r, x, y + r); line(x, y + r, x - 3, y + 2); line(x, y + r, x + 3, y + 2);
    } else if (mechanic === 'laser' || mechanic === 'mirror') {
      line(x - r, y + r, x + r, y - r); line(x - r, y + r, x + r, y + r);
    } else if (mechanic === 'movers' || mechanic === 'gear') {
      circle(x, y, size * 0.72); circle(x, y, size * 0.24);
      line(x, y - r, x, y - r * 0.35); line(x, y + r * 0.35, x, y + r);
    } else {
      circle(x, y, size * 0.72); circle(x, y, size * 0.2);
    }
    pop();
  }

  drawCardBase(hit, accent, active) {
    push();
    rectMode(CORNER);

    noStroke();
    fill(0, 0, 0, 75);
    rect(hit.x + 2, hit.y + 5, hit.w, hit.h, 17);

    fill(15, 25, 36, 244);
    rect(hit.x, hit.y, hit.w, hit.h, 17);

    noFill();
    stroke(active ? '#ffffff' : this.uiColor(accent, 130));
    strokeWeight(active ? 2.6 : 1.4);
    rect(hit.x, hit.y, hit.w, hit.h, 17);

    noStroke();
    fill(accent);
    rect(hit.x + 2, hit.y + 2, hit.w - 4, 7, 6, 6, 0, 0);

    pop();
  }

  drawButton(hit, label, opts = {}) {
    const active = this.isActive(hit);
    const color = opts.color || '#2f8f4a';

    push();
    rectMode(CORNER);

    noStroke();
    fill(0, 0, 0, 70);
    rect(hit.x, hit.y + 3, hit.w, hit.h, 12);

    fill(color);
    rect(hit.x, hit.y, hit.w, hit.h, 12);

    noFill();
    stroke(active ? '#ffffff' : this.uiColor('#ffffff', 55));
    strokeWeight(active ? 2.5 : 1.2);
    rect(hit.x, hit.y, hit.w, hit.h, 12);

    useText(opts.size || 16, true);
    fill(opts.textColor || '#ffffff');
    textAlign(CENTER, CENTER);
    text(label, hit.x + hit.w / 2, hit.y + hit.h / 2 + 1);

    pop();
  }

  drawBackButton() {
    const hit = this.addHitbox(34, 28, 142, 44, () => this.back(), {
      shortcut: 'escape'
    });
    this.drawButton(hit, '‹  VOLVER', {
      color: '#26384a',
      size: 14
    });
  }

  drawTitle(title, subtitle) {
    textAlign(CENTER, TOP);
    useText(33, true);
    fill('#ffffff');
    text(title, this.game.W / 2, 38);

    useText(13.5, false);
    fill('#cfe4f2');
    text(subtitle, this.game.W / 2, 82);
  }

  drawFooterHint(message) {
    textAlign(CENTER, BOTTOM);
    useText(11.5, false);
    fill(255, 255, 255, 125);
    text(message, this.game.W / 2, this.game.H - 18);
  }

  drawStarsRow(cx, cy, earned, total, size) {
    this.game.drawStarsRow(cx, cy, earned, total, size);
  }

  drawHeart(x, y, size, colorValue) {
    push();
    translate(x, y);
    noStroke();
    fill(colorValue);
    ellipse(-size * 0.21, -size * 0.14, size * 0.56, size * 0.56);
    ellipse(size * 0.21, -size * 0.14, size * 0.56, size * 0.56);
    triangle(-size * 0.48, 0, size * 0.48, 0, 0, size * 0.62);
    pop();
  }

  drawInfinity(x, y, size, colorValue) {
    push();
    translate(x, y);
    noFill();
    stroke(colorValue);
    strokeWeight(Math.max(3, size * 0.11));
    ellipse(-size * 0.25, 0, size * 0.58, size * 0.44);
    ellipse(size * 0.25, 0, size * 0.58, size * 0.44);
    pop();
  }

  drawLock(x, y, size, colorValue) {
    push();
    translate(x, y);
    noFill();
    stroke(colorValue);
    strokeWeight(Math.max(2, size * 0.13));
    arc(0, -size * 0.2, size * 0.52, size * 0.52, PI, TWO_PI);
    noStroke();
    fill(colorValue);
    rect(-size * 0.38, -size * 0.12, size * 0.76, size * 0.58, size * 0.1);
    fill(20, 30, 42);
    circle(0, size * 0.1, size * 0.16);
    rect(-size * 0.045, size * 0.12, size * 0.09, size * 0.17);
    pop();
  }

  renderNotice() {
    if (this.noticeTimer <= 0 || !this.notice) return;

    const W = this.game.W;
    const H = this.game.H;
    const alpha = Math.min(1, this.noticeTimer / 0.35);

    useText(14, true);
    const width = Math.min(W - 80, textWidth(this.notice) + 48);
    const x = (W - width) / 2;
    const y = H - 88;

    noStroke();
    fill(8, 14, 21, 220 * alpha);
    rect(x, y, width, 42, 12);
    stroke(255, 255, 255, 40 * alpha);
    strokeWeight(1);
    noFill();
    rect(x, y, width, 42, 12);

    noStroke();
    fill(255, 236, 170, 245 * alpha);
    textAlign(CENTER, CENTER);
    text(this.notice, W / 2, y + 21);
  }

  /* --------------------------- utilidades -------------------------- */

  isActive(hit) {
    return this.hoverId === hit.id || this.focusId === hit.id;
  }

  uiColor(hex, alpha) {
    const c = color(hex);
    c.setAlpha(alpha);
    return c;
  }
}
