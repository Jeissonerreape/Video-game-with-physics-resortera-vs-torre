/* =====================================================================
   Resortera vs. Torre — ALEATORIEDAD DETERMINISTA
   ---------------------------------------------------------------------
   Todo lo que dependa de una semilla pasa por aquí. El objetivo es que
   una semilla de 32 bits produzca siempre la misma secuencia de números,
   en cualquier navegador y en cualquier partida.

   - mulberry32: generador rápido de 32 bits.
   - hash32: mezcla una semilla con un índice (por ejemplo, semilla+nivel).
   - randomSeed32 / parseSeed32: utilidades para el modo Infinito.
   ===================================================================== */

/** Generador determinista de 32 bits (mulberry32). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mezcla dos enteros de 32 bits y devuelve otro entero de 32 bits. */
function hash32(a, b) {
  let h = ((a >>> 0) ^ Math.imul(b >>> 0, 0x9E3779B1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Hash estable de texto, usado para la semilla diaria y etiquetas. */
function hashString32(value) {
  const text = String(value);
  let hash = 0x811C9DC5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Semilla diaria según la fecha local AAAA-MM-DD. */
function dailySeed32(date = new Date()) {
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  return hashString32(day);
}

/** Semilla derivada para un nivel concreto de una partida. */
function levelSeed(baseSeed, depth) {
  return hash32(baseSeed, depth);
}

/** Genera una semilla nueva de 32 bits. */
function randomSeed32() {
  try {
    if (window.crypto && window.crypto.getRandomValues) {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      return buffer[0] >>> 0;
    }
  } catch (e) {
    /* fallback abajo */
  }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/** Convierte texto a una semilla válida de 32 bits, o devuelve null. */
function parseSeed32(value) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  if (!text) return null;

  if (/^0x[0-9a-f]{1,8}$/i.test(text)) {
    return Number.parseInt(text.slice(2), 16) >>> 0;
  }
  if (!/^\d+$/.test(text)) return null;

  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 4294967295) return null;
  return Math.trunc(n) >>> 0;
}

/** Alias usado por el dibujo procedural (piedras, grietas, etc.). */
function makeRng(seed) {
  return mulberry32(seed >>> 0);
}
