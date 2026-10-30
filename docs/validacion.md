# Informe de validación automática de Aventura

Generado: 2026-10-26T00:47:38.699Z

Búsqueda del primer tiro: ángulos 5°–85° cada 1,5°, ocho potencias 40 %–100 % y cada tipo
de munición declarado. La física y el flujo de colisión se ejecutan en `Game.update()` de
`js/game.js` con Matter.js local. Si el primer tiro no gana, se intenta extenderlo con una
búsqueda voraz de secuencias; los tiros mínimos encontrados no certifican un mínimo global.

| ID | Resuelto | Tiros mín. encontrados | Par propuesto | Malla ganadora | Autodestrucción | Trivialidad | Estado |
|---|---:|---:|---:|---:|---|---:|---|
| 1-1 | Sí | 1 | 1 | 1.16% | No | 0.046 | OK |
| 1-2 | Sí | 1 | 1 | 0.12% | No | 0.005 | OK |
| 1-3 | Sí | 2 | 2 | 0.00% | No | 0.000 | OK |
| 1-4 | Sí | 1 | 1 | 1.50% | No | 0.060 | OK |
| 1-5 | Sí | 1 | 1 | 0.12% | No | 0.005 | OK |
| 1-6 | Sí | 1 | 2 | 0.15% | No | 0.006 | OK |
| 1-7 | Sí | 1 | 2 | 6.17% | No | 0.247 | OK |
| 1-8 | Sí | 1 | 2 | 1.00% | No | 0.040 | OK |
| 1-9 | Sí | 1 | 2 | 0.69% | No | 0.028 | OK |
| 1-10 | Sí | 1 | 2 | 0.23% | No | 0.009 | OK |
| 1-11 | Sí | 1 | 4 | 0.62% | No | 0.025 | OK |
| 1-12 | Sí | 2 | 4 | 0.00% | No | 0.000 | OK |
| 2-1 | Sí | 1 | 1 | 0.35% | No | 0.014 | OK |
| 2-2 | Sí | 1 | 1 | 0.23% | No | 0.009 | OK |
| 2-3 | Sí | 2 | 2 | 0.00% | No | 0.000 | OK |
| 2-4 | Sí | 1 | 1 | 1.50% | No | 0.060 | OK |
| 2-5 | Sí | 2 | 2 | 0.00% | No | 0.000 | OK |
| 2-6 | Sí | 1 | 2 | 2.08% | No | 0.083 | OK |
| 2-7 | Sí | 1 | 2 | 6.56% | No | 0.262 | OK |
| 2-8 | Sí | 1 | 2 | 1.00% | No | 0.040 | OK |
| 2-9 | Sí | 1 | 2 | 0.46% | No | 0.019 | OK |
| 2-10 | Sí | 1 | 2 | 4.98% | No | 0.199 | OK |
| 2-11 | Sí | 1 | 4 | 0.62% | No | 0.025 | OK |
| 2-12 | Sí | 2 | 4 | 0.00% | No | 0.000 | OK |
| 3-1 | Sí | 1 | 1 | 0.46% | No | 0.019 | OK |
| 3-2 | Sí | 2 | 2 | 0.00% | No | 0.000 | OK |
| 3-3 | Sí | 2 | 2 | 0.00% | No | 0.000 | OK |
| 3-4 | Sí | 1 | 1 | 1.50% | No | 0.060 | OK |
| 3-5 | Sí | 1 | 1 | 0.93% | No | 0.037 | OK |
| 3-6 | Sí | 1 | 2 | 4.63% | No | 0.185 | OK |
| 3-7 | Sí | 1 | 2 | 6.17% | No | 0.247 | OK |
| 3-8 | Sí | 1 | 2 | 0.85% | No | 0.034 | OK |
| 3-9 | Sí | 1 | 2 | 0.54% | No | 0.022 | OK |
| 3-10 | Sí | 1 | 2 | 2.95% | No | 0.118 | OK |
| 3-11 | Sí | 1 | 4 | 0.46% | No | 0.019 | OK |
| 3-12 | Sí | 2 | 4 | 0.00% | No | 0.000 | OK |
| 4-1 | Sí | 1 | 1 | 2.31% | No | 0.093 | OK |
| 4-2 | Sí | 1 | 1 | 0.12% | No | 0.005 | OK |
| 4-3 | Sí | 2 | 2 | 0.00% | No | 0.000 | OK |
| 4-4 | Sí | 1 | 1 | 1.50% | No | 0.060 | OK |
| 4-5 | Sí | 1 | 1 | 0.12% | No | 0.005 | OK |
| 4-6 | Sí | 1 | 2 | 0.39% | No | 0.015 | OK |
| 4-7 | Sí | 1 | 2 | 5.86% | No | 0.235 | OK |
| 4-8 | Sí | 1 | 2 | 0.93% | No | 0.037 | OK |
| 4-9 | Sí | 1 | 2 | 0.85% | No | 0.034 | OK |
| 4-10 | Sí | 1 | 2 | 6.13% | No | 0.245 | OK |
| 4-11 | Sí | 1 | 4 | 0.27% | No | 0.011 | OK |
| 4-12 | Sí | 2 | 4 | 0.00% | No | 0.000 | OK |
| 5-1 | Sí | 1 | 1 | 2.20% | No | 0.088 | OK |
| 5-2 | Sí | 1 | 1 | 0.23% | No | 0.009 | OK |
| 5-3 | Sí | 2 | 2 | 0.00% | No | 0.000 | OK |
| 5-4 | Sí | 1 | 1 | 1.50% | No | 0.060 | OK |
| 5-5 | Sí | 2 | 2 | 0.00% | No | 0.000 | OK |
| 5-6 | Sí | 2 | 2 | 0.00% | No | 0.000 | OK |
| 5-7 | Sí | 1 | 2 | 8.56% | No | 0.343 | OK |
| 5-8 | Sí | 1 | 2 | 0.69% | No | 0.028 | OK |
| 5-9 | Sí | 1 | 2 | 0.77% | No | 0.031 | OK |
| 5-10 | Sí | 1 | 2 | 2.55% | No | 0.102 | OK |
| 5-11 | Sí | 1 | 4 | 0.31% | No | 0.012 | OK |
| 5-12 | Sí | 2 | 4 | 0.00% | No | 0.000 | OK |

## Problemas y propuestas

Sin problemas detectados por las reglas automáticas.

## Soluciones de referencia

| ID | Secuencia ganadora (ángulo / potencia / proyectil) |
|---|---|
| 1-1 | 1. 33.5° / 91% / normal |
| 1-2 | 1. 51.5° / 83% / normal |
| 1-3 | 1. 57.5° / 100% / normal; 2. 5° / 100% / normal |
| 1-4 | 1. 36.5° / 100% / normal |
| 1-5 | 1. 11° / 66% / heavy |
| 1-6 | 1. 39.5° / 91% / bounce |
| 1-7 | 1. 33.5° / 83% / normal |
| 1-8 | 1. 41° / 91% / bounce |
| 1-9 | 1. 30.5° / 100% / normal |
| 1-10 | 1. 8° / 83% / bounce |
| 1-11 | 1. 48.5° / 91% / rocket |
| 1-12 | 1. 27.5° / 100% / explosive; 2. 39.5° / 83% / bounce |
| 2-1 | 1. 30.5° / 91% / normal |
| 2-2 | 1. 17° / 100% / normal |
| 2-3 | 1. 56° / 100% / normal; 2. 5° / 100% / normal |
| 2-4 | 1. 36.5° / 100% / normal |
| 2-5 | 1. 9.5° / 100% / normal; 2. 9.5° / 83% / normal |
| 2-6 | 1. 39.5° / 91% / bounce |
| 2-7 | 1. 20° / 100% / normal |
| 2-8 | 1. 26° / 91% / normal |
| 2-9 | 1. 30.5° / 100% / normal |
| 2-10 | 1. 33.5° / 100% / bounce |
| 2-11 | 1. 65° / 100% / rocket |
| 2-12 | 1. 39.5° / 100% / explosive; 2. 47° / 83% / bounce |
| 3-1 | 1. 20° / 100% / normal |
| 3-2 | 1. 24.5° / 91% / normal; 2. 17° / 100% / normal |
| 3-3 | 1. 56° / 100% / normal; 2. 8° / 91% / normal |
| 3-4 | 1. 36.5° / 100% / normal |
| 3-5 | 1. 27.5° / 91% / normal |
| 3-6 | 1. 23° / 100% / normal |
| 3-7 | 1. 18.5° / 100% / normal |
| 3-8 | 1. 23° / 100% / bounce |
| 3-9 | 1. 30.5° / 100% / normal |
| 3-10 | 1. 17° / 100% / explosive |
| 3-11 | 1. 18.5° / 83% / normal |
| 3-12 | 1. 65° / 91% / bounce; 2. 33.5° / 100% / normal |
| 4-1 | 1. 27.5° / 100% / normal |
| 4-2 | 1. 20° / 100% / normal |
| 4-3 | 1. 48.5° / 100% / normal; 2. 5° / 100% / normal |
| 4-4 | 1. 36.5° / 100% / normal |
| 4-5 | 1. 26° / 91% / normal |
| 4-6 | 1. 6.5° / 83% / bounce |
| 4-7 | 1. 26° / 83% / bounce |
| 4-8 | 1. 27.5° / 100% / normal |
| 4-9 | 1. 27.5° / 100% / normal |
| 4-10 | 1. 5° / 100% / bounce |
| 4-11 | 1. 6.5° / 100% / rocket |
| 4-12 | 1. 39.5° / 100% / explosive; 2. 65° / 66% / bounce |
| 5-1 | 1. 27.5° / 100% / normal |
| 5-2 | 1. 17° / 100% / normal |
| 5-3 | 1. 56° / 100% / normal; 2. 5° / 100% / normal |
| 5-4 | 1. 36.5° / 100% / normal |
| 5-5 | 1. 29° / 74% / normal; 2. 11° / 83% / normal |
| 5-6 | 1. 47° / 91% / normal; 2. 8° / 57% / bounce |
| 5-7 | 1. 27.5° / 83% / normal |
| 5-8 | 1. 27.5° / 100% / normal |
| 5-9 | 1. 36.5° / 91% / bounce |
| 5-10 | 1. 30.5° / 74% / bounce |
| 5-11 | 1. 74° / 100% / bounce |
| 5-12 | 1. 69.5° / 91% / bounce; 2. 24.5° / 100% / normal |
