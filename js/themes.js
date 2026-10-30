/* =====================================================================
   Resortera vs. Torre — TEMAS DE MUNDO
   Paletas, capas de fondo y partículas ambientales.
   ===================================================================== */

const THEMES = {
  1: {
    id: 'meadow',
    nombre: 'Pradera',
    palette: {
      skyTop: '#f08d70', skyBottom: '#ffe2aa', ground: '#795335', groundTop: '#82a94d',
      blocks: { wood: '#c58a52', stone: '#8c9b91', glass: 'rgba(171,224,225,0.76)' },
      accent: '#f5c56b', reactor: '#72dcab'
    },
    layers: ['hills-far', 'hills-near', 'meadow'],
    particles: { kind: 'pollen', color: '#ffe39a', count: 14, speed: 1.1 },
    groundStyle: 'grass'
  },
  2: {
    id: 'canyon',
    nombre: 'Cañón de arena',
    palette: {
      skyTop: '#d7653c', skyBottom: '#f8bd74', ground: '#70452f', groundTop: '#c37a43',
      blocks: { wood: '#bd7846', stone: '#aa8065', glass: 'rgba(227,188,144,0.72)' },
      accent: '#ffd08b', reactor: '#ffe075'
    },
    layers: ['mesa-far', 'mesa-near', 'dunes'],
    particles: { kind: 'sand', color: '#f6c27d', count: 18, speed: 2.0 },
    groundStyle: 'sand'
  },
  3: {
    id: 'reef',
    nombre: 'Puerto y arrecife',
    palette: {
      skyTop: '#2783aa', skyBottom: '#a5e1dc', ground: '#4d665d', groundTop: '#6eaa9c',
      blocks: { wood: '#9a775c', stone: '#718c91', glass: 'rgba(149,227,235,0.76)' },
      accent: '#85e1df', reactor: '#76f0d7'
    },
    layers: ['sea-far', 'islands', 'reef'],
    particles: { kind: 'bubbles', color: '#c3fff4', count: 16, speed: 1.4 },
    groundStyle: 'shore'
  },
  4: {
    id: 'factory',
    nombre: 'Fábrica',
    palette: {
      skyTop: '#353d45', skyBottom: '#879095', ground: '#383638', groundTop: '#8e6547',
      blocks: { wood: '#a8754c', stone: '#727a7c', glass: 'rgba(158,201,204,0.72)' },
      accent: '#e5a36b', reactor: '#ffb45c'
    },
    layers: ['factory-far', 'gears', 'factory-near'],
    particles: { kind: 'steam', color: '#d2d1c8', count: 10, speed: 0.85 },
    groundStyle: 'metal'
  },
  5: {
    id: 'orbit',
    nombre: 'Estación orbital',
    palette: {
      skyTop: '#080b1c', skyBottom: '#211436', ground: '#292437', groundTop: '#75637e',
      blocks: { wood: '#95706a', stone: '#747687', glass: 'rgba(165,192,233,0.72)' },
      accent: '#cf9cf4', reactor: '#bca2ff'
    },
    layers: ['stars', 'nebula', 'planet'],
    particles: { kind: 'stars', color: '#f6eeff', count: 28, speed: 0.35 },
    groundStyle: 'alloy'
  }
};

function getTheme(theme) {
  if (typeof theme === 'number' || /^\d+$/.test(String(theme))) {
    return THEMES[Number(theme)] || THEMES[1];
  }
  return Object.values(THEMES).find((item) => item.id === theme) || THEMES[1];
}
