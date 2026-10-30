/* =====================================================================
   Resortera vs. Torre — punto de entrada (p5.js)
   ---------------------------------------------------------------------
   - setup(): crea el lienzo, el juego y los controles de puntero
   - draw():  actualiza la simulación y dibuja el frame
   ===================================================================== */

let game = null;
let gameCanvas = null;

function setup() {
  gameCanvas = createCanvas(CONFIG.WIDTH, CONFIG.HEIGHT);
  gameCanvas.parent('game');
  gameCanvas.elt.style.touchAction = 'none';

  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  frameRate(60);
  textFont(FONT_FAMILY, 14);
  ellipseMode(CENTER);
  rectMode(CORNER);

  game = new Game(gameCanvas);
  installPointer(gameCanvas.elt);
}

function draw() {
  if (!game) return;
  game.update(deltaTime / 1000);
  game.render();
}

/* --------------------- controles de puntero ------------------------ */
/* Se usan eventos de puntero (ratón + táctil) y se convierten las
   coordenadas de pantalla a coordenadas del lienzo, de modo que el juego
   funciona igual aunque el canvas se escale con CSS.                  */
function installPointer(el) {
  const toWorld = (e) => {
    const r = el.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * CONFIG.WIDTH,
      y: ((e.clientY - r.top) / r.height) * CONFIG.HEIGHT
    };
  };

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignorar */ }
    if (game) game.pointerDown(toWorld(e));
  });

  window.addEventListener('pointermove', (e) => {
    if (game) game.pointerMove(toWorld(e));
  });

  window.addEventListener('pointerup', () => {
    if (game) game.pointerUp();
  });

  window.addEventListener('pointercancel', () => {
    if (game) game.pointerUp();
  });

  window.addEventListener('blur', () => {
    if (game) game.pointerUp();
  });

  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

function keyPressed() {
  if (game) game.keyPressed();
}
