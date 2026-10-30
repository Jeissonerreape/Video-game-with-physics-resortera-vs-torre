/* =====================================================================
   Resortera vs. Torre — AUDIO
   Efectos sintetizados con WebAudio (sin archivos de sonido externos).
   El AudioContext se crea en el primer clic para respetar las políticas
   de reproducción automática de los navegadores.
   ===================================================================== */

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.lastHitAt = 0;
    this.lastDominoAt = 0;
    this.muted = false;
    try {
      this.muted = localStorage.getItem(CONFIG.MUTE_KEY) === '1';
    } catch (e) {
      this.muted = false;
    }
  }

  /** Crea/reanuda el contexto de audio. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.4;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoise(0.35);
    } catch (e) {
      this.ctx = null;
    }
  }

  makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      // ruido con caída exponencial (más "impacto", menos "siseo")
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    return buf;
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.4;
    try {
      localStorage.setItem(CONFIG.MUTE_KEY, this.muted ? '1' : '0');
    } catch (e) { /* modo privado */ }
    return this.muted;
  }

  get enabled() {
    return !!this.ctx && !this.muted;
  }

  /** Tono simple con envolvente y barrido de frecuencia. */
  tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    this.ensure();
    if (!this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /** Golpe de ruido filtrado (impactos secos). */
  noise(dur, vol, freq = 900, type = 'bandpass') {
    this.ensure();
    if (!this.enabled || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    src.buffer = this.noiseBuffer;
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = 0.7;

    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // --- Efectos concretos ---------------------------------------------
  launch(power) {
    this.tone(150 + power * 120, 0.18, 'triangle', 0.22, 420);
    this.noise(0.14, 0.10 + 0.08 * power, 1500, 'highpass');
  }

  hit(strength) {
    const now = performance.now();
    if (now - this.lastHitAt < 45) return; // evita saturación
    this.lastHitAt = now;
    this.tone(80 + Math.random() * 45, 0.10, 'square', 0.07 + 0.10 * strength, -35);
    this.noise(0.07, 0.05 + 0.13 * strength, 420, 'lowpass');
  }

  shatter() {
    this.noise(0.22, 0.16, 2600, 'highpass');
    this.tone(1100, 0.10, 'triangle', 0.08, -300);
  }

  breakBlock() {
    this.noise(0.20, 0.18, 1300, 'bandpass');
    this.tone(140, 0.13, 'sawtooth', 0.09, -80);
  }

  /** Explosión: ruido grave, crujido y un golpe de sub. */
  explosion() {
    this.noise(0.42, 0.30, 260, 'lowpass');
    this.noise(0.26, 0.20, 1400, 'bandpass');
    this.tone(72, 0.38, 'sine', 0.20, -34);
    this.tone(148, 0.22, 'sawtooth', 0.10, -70, 0.02);
  }

  /** División del proyectil: tres "pops" rápidos y agudos. */
  split() {
    [0, 0.035, 0.07].forEach((delay, i) => {
      this.tone(620 + i * 140, 0.08, 'square', 0.09, 240, delay);
    });
    this.noise(0.10, 0.08, 2200, 'highpass');
  }

  /** Ignición del cohete: siseo filtrado y tono ascendente. */
  rocketIgnite() {
    this.noise(0.34, 0.13, 1200, 'bandpass');
    this.tone(180, 0.32, 'sawtooth', 0.08, 520);
    this.tone(90, 0.24, 'sine', 0.06, 40, 0.03);
  }

  /** Rebote elástico del proyectil de goma. */
  bounce() {
    this.tone(380, 0.10, 'triangle', 0.10, 260);
    this.tone(760, 0.08, 'sine', 0.05, 180, 0.02);
  }

  /** Chapoteo: ruido filtrado (agua) + un tono grave que se apaga. */
  splash(strength) {
    const s = Math.max(0.1, Math.min(1, strength || 0.5));
    this.noise(0.18 + 0.20 * s, 0.08 + 0.11 * s, 850, 'lowpass');
    this.noise(0.12, 0.04 + 0.05 * s, 2400, 'highpass');
    this.tone(150 + s * 90, 0.15, 'sine', 0.04 + 0.04 * s, -70);
  }

  pop() {
    this.tone(520, 0.09, 'square', 0.13, 480);
    this.tone(820, 0.12, 'sine', 0.09, 260, 0.05);
  }

  /** Zumbido grave del imán (se llama con moderación desde el campo). */
  magnetHum() {
    this.tone(68, 0.20, 'sawtooth', 0.035, 16);
    this.tone(136, 0.18, 'triangle', 0.025, 10, 0.02);
  }

  /** Crepitar del fuego y chispas del hielo al derretirse. */
  crackle() {
    this.noise(0.09, 0.045, 2400, 'highpass');
    this.tone(240, 0.05, 'square', 0.018, 80);
  }

  /** Tic de la polea al girar la cuerda. */
  pulleyTick() {
    this.noise(0.04, 0.035, 1800, 'bandpass');
    this.tone(780, 0.045, 'square', 0.026, -120);
  }

  /** Pitido corto del láser. */
  laser() {
    this.tone(1320, 0.07, 'square', 0.05, -420);
    this.tone(1980, 0.05, 'sine', 0.025, -300, 0.015);
  }

  reload() {
    this.tone(330, 0.07, 'sine', 0.07, 70);
  }

  ropeCut() {
    this.noise(0.12, 0.14, 1900, 'highpass');
    this.tone(260, 0.10, 'triangle', 0.09, -120);
  }

  lever() {
    this.tone(120, 0.14, 'sawtooth', 0.08, 90);
    this.noise(0.10, 0.09, 700, 'lowpass');
  }

  domino() {
    const now = performance.now();
    if (now - this.lastDominoAt < 55) return;
    this.lastDominoAt = now;
    this.tone(620 + Math.random() * 90, 0.05, 'square', 0.035, -120);
    this.noise(0.04, 0.035, 1300, 'bandpass');
  }

  switchOn() {
    this.tone(440, 0.18, 'sine', 0.14, 260);
    this.tone(660, 0.22, 'triangle', 0.11, 220, 0.06);
    this.tone(990, 0.26, 'sine', 0.08, 120, 0.12);
    this.noise(0.10, 0.06, 2400, 'highpass');
  }

  heart() {
    this.tone(660, 0.16, 'sine', 0.12, 220);
    this.tone(990, 0.24, 'triangle', 0.10, 180, 0.07);
    this.tone(1320, 0.28, 'sine', 0.07, 90, 0.14);
  }

  bossHit() {
    this.tone(90, 0.22, 'sawtooth', 0.14, -45);
    this.noise(0.20, 0.18, 520, 'lowpass');
    this.tone(310, 0.18, 'square', 0.07, 140, 0.03);
  }

  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, 0.26, 'triangle', 0.16, 0, i * 0.11);
    });
  }

  lose() {
    [392, 311.13, 246.94].forEach((f, i) => {
      this.tone(f, 0.34, 'triangle', 0.15, 0, i * 0.16);
    });
  }
}
