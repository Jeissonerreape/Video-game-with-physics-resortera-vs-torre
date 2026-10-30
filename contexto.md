## 1. Resumen del proyecto

**Qué es.** *Resortera vs. Torre* es un juego 2D de física en el que se lanza un proyectil con una
resortera para derribar estructuras y, en los niveles nuevos, para encadenar mecanismos (cuerdas,
palancas y dominós) hasta activar un reactor o derrotar a un jefe.

**Stack.** JavaScript vanilla + **p5.js** para el dibujo + **matter.js** para los cuerpos rígidos.
Las dos librerías están vendorizadas en `lib/` (sin CDN ni instalación). No hay imágenes, audios ni
fuentes externas: todo el arte se dibuja por código y los efectos se sintetizan con **WebAudio**.

**Resolución y vista.** Lienzo lógico fijo de **1280 × 720** (16:9), escalado con CSS. No hay cámara
ni scroll: todo el escenario cabe en pantalla.

**Modos.**

| Modo | Estado real | Contenido |
|---|---|---|
| **Clásico** | Jugable y cerrado | Los 6 niveles originales, su puntuación, récords y estrellas |
| **Aventura** | 60 niveles validados automáticamente | 5 mundos × 12 niveles, con estrellas, campos, munición, corazones y jefes |
| **Hardcore** | Jugable | Campaña ordenada de 60 niveles, una vida, mínimo 3 estrellas y guardado por checkpoint |
| **Infinito** | Jugable | Generador determinista, validación headless, mutadores, semillas y ranking local |

**Estado actual (2026-10-25).**

- El **modo Clásico** funciona completo: 6 niveles, puntuación original, estrellas y récord por
  nivel guardados en `localStorage` con la clave `resortera_vs_torre_save_v2`.
- **Aventura** tiene 60 definiciones jugables (12 por mundo), con campos, munición, materiales,
  corazones, circuitos y jefes por datos. El simulador determinista encontró soluciones para los 60;
  sus tiros de referencia, tasa de malla y estado están en `docs/validacion.md`.
- **Hardcore** y **Infinito** ya tienen flujo jugable. Hardcore persiste mejor run, historial y
  checkpoint entre niveles; Infinito genera/valida asincrónicamente, acepta semillas decimal/hex,
  diaria y ranking local global/por semilla.
- Están implementados: paso fijo de física, trayectoria prevista, daño por impacto, materiales,
  cuerdas cortables, palancas, dominós, reactores, corazones, jefe, estrellas, pausa con `Esc`,
  overlay de física con `V`, audio sintetizado y guardado tolerante a fallos.
- **Campos (viento y agua)** implementados como datos por nivel (`fields`), con un registro de
  módulos (`Fields.registry`), predicción de trayectoria con los mismos campos, overlay didáctico
  y niveles ocultos de prueba. Los 6 clásicos no tienen `fields` y su física sigue siendo idéntica.
- **Campos avanzados** implementados como datos por nivel: pozos/repulsores, zonas de gravedad,
  plataformas móviles, poleas de Atwood, imanes, láser con espejos y térmica. Viven en
  `js/fields-advanced.js`, usan los mismos `drawBack`/`draw`/`overlay` y predicción, y tienen
  niveles ocultos (`wells`, `gravityZones`, `movers`, `pulleys`, `magnets`, `lasers`, `thermal`,
  `combined`). El modo Clásico sigue sin `fields`.
- **Proyectiles especiales**: seis tipos configurables por nivel, selección en HUD/teclado,
  predicción específica y test oculto con ocho tiros. Los 6 niveles clásicos siguen usando normal.
- **Temas y plantillas**: cinco fondos parallax, partículas y ambientes WebAudio; `WORLDS[1..5]`,
  `THEMES[1..5]`, `STRUCTURES`, `TEMPLATES` e intensidad de campos. El Clásico mantiene sus seis
  niveles separados y originales.

**Qué no está hecho.** Aún no se ha ejecutado el lote de aceptación de 50 niveles por 5 semillas ni
un run completo de Hardcore en navegador. También faltan playtesting humano y comprobación manual
de jefes, estrellas/desbloqueos, rendimiento en móviles, migración del récord antiguo y determinismo
estricto de los temporizadores de fase (ver sección 7).

## 2. Decisiones de diseño

> Las fechas de las decisiones anteriores a este archivo son la fecha del **registro inicial**
> (2026-10-25), no la de implementación: el proyecto no tiene historial git ni `contexto.md` previo.
> La columna “fecha” sirve para saber cuándo quedó documentada cada decisión.

| Decisión | Motivo | Fecha |
|---|---|---|
| **Paso fijo de 1/60 s** con acumulador y `MAX_STEPS = 4` | La simulación no debe depender de los FPS; el mismo disparo produce el mismo resultado en un equipo lento y en uno rápido | 2026-10-25 (registro) |
| **Toda la simulación usa pasos y RNG con semilla** (`mulberry32`, `hash32`) | Evitar `Date.now()` y `Math.random()` en la física; preparar Infinito con semillas de 32 bits reproducibles | 2026-10-25 (registro) |
| **Sensores para reactores, corazones y jefe** (`isSensor: true`) | Detectar contactos sin que el objetivo sea un muro físico; así el peso, el bloque o una ficha pueden entrar en el reactor | 2026-10-25 (registro) |
| **Niveles como datos**, no como `if (mundo === n)` | Un único `loadLevel(def, meta)` sirve para Clásico, Aventura, Hardcore e Infinito; el motor no conoce números de mundo | 2026-10-25 (registro) |
| **Vista fija 1280 × 720**, sin cámara | El jugador puede juzgar distancias y ángulos; todo el escenario cabe y el CSS mantiene el 16:9 | 2026-10-25 (registro) |
| **Sin assets externos**: arte procedural y WebAudio | El juego funciona offline y no depende de imágenes, audios, fuentes ni CDN | 2026-10-25 (registro) |
| **Tres objetivos con la misma base física**: `destroyAll`, `switch`, `boss` | Reutilizar el motor y convertir precisión, cadena causal y duelos en variantes de una misma mecánica | 2026-10-25 (registro) |
| **Guardado por nivel en la clave `resortera_vs_torre_save_v2`** | Mantener Clásico y Aventura separados, conservar récords y estrellas, y tolerar datos corruptos o `localStorage` bloqueado | 2026-10-25 (registro) |
| **Estrellas**: 5 si `tirosUsados <= par`; después `max(1, 5 - (tirosUsados - par))` | Premiar la precisión con una regla simple y legible en el HUD y en el panel final | 2026-10-25 (registro) |
| **Clásico intocable**: mismos 6 niveles, misma puntuación, sin corazones y sin bonus de estrellas | Es la referencia original; los modos nuevos no deben alterar su comportamiento ni sus récords | 2026-10-25 (registro) |
| **Reactores `requireChain`** | En los niveles de cadena el proyectil no debe resolver el nivel solo; la reacción tiene que llegar por los dominós | 2026-10-25 (registro) |
| **Jefe con teletransporte y obstáculos acumulativos** | Convertir el jefe en un duelo por turnos: cada golpe cambia la posición y obliga a buscar un ángulo nuevo | 2026-10-25 (registro) |
| **Corazones solo para el proyectil**: +1 tiro y +150 puntos | Recompensa opcional que no rompe el ritmo; el tiro extra cuenta para las estrellas si se usa | 2026-10-25 (registro) |
| **Cola `doomed` y `flushDoomed()`** | No mutar el mundo de matter.js mientras recorre los pares en colisión | 2026-10-25 (registro) |
| **Ventana de gracia de 0,6 s al cargar** | Evitar que la estructura se autodestruya mientras se asienta; los sensores quedan fuera de la excepción | 2026-10-25 (registro) |
| **Overlay didáctico con `V`** | Mostrar vectores, centro de masa, energía y tensión sin afectar la jugabilidad | 2026-10-25 (registro) |
| **Audio creado en el primer gesto** (`ensure()` en `pointerDown`) | Respetar las políticas de autoplay de los navegadores | 2026-10-25 (registro) |
| **Densidad sobrescribible por pieza** (`density` en el dato del nivel) | Ajustar inercia sin crear materiales nuevos: palanca muy ligera y bloque lanzado ligero | 2026-10-25 (registro) |
| **Campos como datos + registro de módulos** (`Fields.registry`) | El motor no conoce “viento” ni “agua”: cada campo implementa `init/apply/draw/overlay` y se activa con `fields` en el nivel; sin `fields` no se toca ningún cuerpo | 2026-10-25 |
| **Viento proporcional al área, no a la masa** | Los cuerpos ligeros deben desviarse más; con `drag` la fuerza es relativa a la velocidad del viento y el cuerpo no acelera sin límite | 2026-10-25 |
| **Ráfagas deterministas por paso** (`sin(2π·step/period)`) | Reproducibilidad estricta: nada de `Math.random()` ni tiempo real dentro de la simulación | 2026-10-25 |
| **Agua con fracción sumergida exacta** (segmento circular / recorte de polígono) | El empuje y el arrastre dependen del volumen realmente sumergido; el centroide permite aplicar el empuje descentrado y generar par | 2026-10-25 |
| **Densidad de agua 0.0040 y arrastre 0.085** | Con los materiales actuales, el vidrio flota alto, la madera al 60 %, la piedra se hunde y el proyectil se frena casi en seco | 2026-10-25 |
| **Predicción con `Fields.apply` sobre un proyectil virtual** | Evitar una segunda fórmula de trayectoria; la línea debe coincidir con el vuelo real antes del primer choque | 2026-10-25 |
| **Trabajo de campos por diferencia de energía** (`ΔEc − Wgravedad`) | El panel de `V` incluye el viento y el arrastre del agua sin instrumentar cada fuerza; se documenta que `Ec+Ep` deja de conservarse | 2026-10-25 |
| **`loadLevel(def, meta)` como único punto de carga** | `restartLevel()` y los modos futuros reutilizan exactamente el mismo pipeline | 2026-10-25 (registro) |
| **Par por defecto `shots - 1` en Clásico** | Conserva la regla original sin añadir campos a los 6 niveles históricos | 2026-10-25 (registro) |
| **Munición especial declarada por nivel** (`ammo`) | El motor no depende del número de mundo; sin dato, usa `shots` normales para preservar Clásico | 2026-10-25 |
| **Temas y plantillas declarados por mundo** (`WORLDS`, `THEMES`, `TEMPLATES`) | Mantener contenido y ambiente como datos, con niveles aún incompletos sin ramas especiales en el motor | 2026-10-25 |

## 3. Registro de cambios

### [2026-10-25 15:02] Fase 0 — Memoria viva del proyecto

- **Qué se hizo.** Se leyó `README.md` completo y se revisaron enteros `index.html`,
  `css/style.css`, `serve.js` y los 9 archivos de `js/`. Se creó este `contexto.md` con las 8
  secciones pedidas, verificando los valores contra `config.js`, `levels.js` y `campaign.js` en
  lugar de copiarlos del README. **No se modificó ningún archivo de código.**
- **Archivos creados / modificados.** `contexto.md` (creado). Ningún otro archivo.
- **Valores elegidos y por qué.** Se documentaron los valores reales de `CONFIG`, `MATERIALS`,
  `TARGET`, `LEVELS` y `CAMPAIGN_LEVELS`; se dejaron explícitos los campos y multiplicadores por
  mundo como **no implementados** para que una sesión futura no los invente. Se registró la deuda
  técnica conocida (temporizadores con `dt` real, `Math.random()` en arte/audio, `theme` y
  `mechanic` sin consumir, migración desde `BEST_KEY`) para no confundirla con funcionalidad
  terminada.
- **Cómo se probó.** `node --check` sobre los 9 archivos de `js/` y `serve.js`: todos OK. Carga de
  `index.html` con el servidor local: canvas de 1280 × 720, título correcto y **0 errores y 0
  advertencias** en consola. Clásico: `startClassic(0)` carga “El establo” en `ready`, 3 tiros y
  par 2; un disparo de prueba termina con 120 puntos, 1 objetivo restante, 2 tiros y vuelve a
  `ready`. También se navegó el menú real con clics: **Aventura → Mundo 1 → 1-1** y
  **Modo Clásico → nivel 1**, ambos llegan a `screen: 'play'` sin errores. Aventura: 1-7 carga con
  1 reactor, 4 tiros y par 3; 1-9 con 1 corazón y 3 objetivos; 1-12 con jefe de 3 golpes, 6 tiros y
  par 4. Se comprobó que el Mundo 1 tiene 12 niveles `ready: true` y que los mundos 2–5 tienen 0
  niveles listos. Se probó `Progress` con
  `localStorage` vacío y corrupto (usa los valores por defecto), el guardado de un nivel de prueba
  (conserva el máximo de puntos y estrellas) y la reproducibilidad de `mulberry32`/`hash32`. La
  clave de prueba se eliminó; no se tocó el guardado real.
- **Problemas y soluciones.** No hubo errores de código. El puerto 8123 ya estaba ocupado por otra
  instancia del servidor, así que se reutilizó la instancia activa; el guardado se probó con una
  clave temporal (`__ctx_test_save__`) para no modificar datos reales. Los problemas históricos y sus
  soluciones están en la sección 6.
- **Pendientes.** Los de la sección 7. El siguiente hito es la **fase 4 — Hardcore**. En esta fase
  no se modificó ningún archivo de código.

### [2026-10-25 15:19] Fase campos — Viento y agua

- **Qué se hizo.** Se añadió un sistema de **campos ambientales como datos**: cada nivel puede
  declarar `fields: { wind, water }` y el motor activa los módulos correspondientes de
  `Fields.registry`. Se implementaron viento (fuerza por área, ráfagas deterministas y modo
  `drag`), agua (empuje por fracción sumergida exacta, arrastre, amortiguación angular, superficie
  que puede subir, burbujas y chapoteo) y una **predicción de trayectoria compartida** que aplica
  los mismos módulos sobre un proyectil virtual. El overlay `V` muestra viento, empuje/peso y el
  trabajo de los campos (`Wcampos`). Se añadieron dos niveles ocultos de prueba (`TEST_LEVELS.wind`
  y `.water`) y `game.startTestLevel(nombre)`. Los 6 clásicos no declaran `fields`, así que su
  física no cambia.
- **Archivos creados / modificados.** Creados: `js/fields.js`, `js/testlevels.js`. Modificados:
  `index.html` (orden de carga), `js/config.js` (constantes `FIELD_*`), `js/game.js` (estado y reset
  de campos, orden del paso fijo, `simStep`, trabajo de campos, predicción, chapoteo, HUD,
  overlay, `startTestLevel` y `meta.screen`), `js/audio.js` (`Sfx.splash`), `js/campaign.js`
  (propaga `fields` de los niveles fuente), `README.md` (sección 4.10, arquitectura y datos de
  nivel) y este `contexto.md`.
- **Valores elegidos y por qué.** Viento `FIELD_WIND_C = 6.4e-8` y tope
  `FIELD_WIND_MAX_FORCE = 0.02` por cuerpo y paso. Calibración con el proyectil normal (`r = 17`,
  densidad `0.0085`), potencia 100 % y 45°: con `fx = 1.0`, `drag: true` y sin ráfagas, a los 53
  pasos —cuando el tiro sin viento ha recorrido 800 px— el desvío euclídeo es **48,7 px** (45,1 px
  horizontal), dentro del objetivo de 30–60 px. El modo `drag` evita que los cuerpos aceleren sin
  límite y el tope protege contra áreas grandes. Las ráfagas usan
  `1 + gust · sin(2π · step / period)`, sin `Math.random()` ni tiempo real. Agua:
  `FIELD_WATER_DENSITY = 0.0040`, `FIELD_WATER_DRAG = 0.085`,
  `FIELD_WATER_ANGULAR_DAMP = 0.30`, `FIELD_SPLASH_SPEED = 2.5` y
  `FIELD_PREDICT_STEPS = 150`. La densidad 0.0040 deja el vidrio al ~40 %, la madera al ~60 % y
  hunde la piedra y el proyectil; el arrastre 0.085 frena la entrada de 18,5 px/paso a 1,2 px/paso
  en ~20 pasos. La geometría usa la fórmula exacta del segmento circular y el recorte de polígono
  con centroide, para que el empuje descentrado genere par.
- **Cómo se probó.** `node --check` sobre todos los `js/*.js` y `serve.js`: OK. Regresión del
  Clásico: se capturaron los hashes de tres disparos fijos con el código original y se repitieron
  tras el cambio (**182783528**, **486575621**, **2596526766**: idénticos), con la misma puntuación
  y posiciones finales. Predicción con viento: 48 puntos antes del primer choque, error máximo
  **3,5e-12 px** frente al vuelo real. Agua: `waterY = 540`, madera con fracción **0,600**, vidrio
  **0,401**, piedra **1,0** (se hunde). En el navegador se cargaron los niveles ocultos, se
  ejecutaron disparos y `game.render()` con `showPhysics = true` sin errores ni advertencias en
  consola. El puerto 8123 ya estaba ocupado, así que se reutilizó el servidor activo.
- **Problemas y soluciones.** La captura de pantalla del navegador falla con “Screenshot needs a
  visible tab”, así que la inspección visual se hizo por estado/consola y no por imagen. Para poder
  cargar un nivel de prueba desde consola se añadió `meta.screen = 'play'` opcional a `loadLevel`;
  sin él la carga se quedaba en el menú. La predicción dejó de ser una parábola: ahora clona un
  círculo virtual y llama a `Fields.apply` paso a paso, parando en el primer choque sólido, en la
  superficie del agua o a los 150 pasos. El panel de energía calcula el trabajo de los campos como
  `ΔEc − Wgravedad` y avisa de que `Ec + Ep` ya no se conserva.
- **Pendientes en esa fase.** Añadir **multiplicadores de viento por mundo** (resuelto en la fase
  de temas e intensidad), niveles de campaña con agua creciente (por ejemplo, el jefe del Mundo 3),
  medir el coste de la geometría sumergida con muchas piezas y decidir cómo balancear los campos
  en mundos futuros. Ver sección 7.

### [2026-10-25 15:41] Fase 3.6 — Campos avanzados

- **Qué se hizo.** Se amplió `Fields.registry` con siete módulos nuevos en
  `js/fields-advanced.js`: `wells` (pozos y repulsores), `gravityZones` (gravedad local),
  `movers` (plataformas móviles con carga), `pulleys` (máquina de Atwood con cuerda cortable),
  `magnets` (solo materia ferrosa), `lasers` (rayo con espejos y reactor) y `thermal` (fuegos e
  hielo que se derrite). Todos se configuran con datos en `def.fields`, tienen `drawBack`, `draw` y
  `overlay` didáctico, y añaden niveles ocultos de prueba. Se respetó el modo Clásico: los 6
  niveles no declaran `fields` y su física, puntuación y guardado no cambian.
- **Archivos creados / modificados.** Creado: `js/fields-advanced.js`. Modificados:
  `index.html` (carga del módulo), `js/fields.js` (contexto `{ game, predict }`, `drawBack`,
  `afterUpdate`, `checkCuts`, arrays de definición y eventos compartidos), `js/game.js`
  (predicción con contexto, `consumeFieldEvents`, `measureAtwood`, `attachToMover`, `meltIce`,
  `setLaserTarget`, `laserTarget`/`iceMelt`), `js/config.js` (constantes `FIELD_WELL_*`,
  `FIELD_ZONE_*`, `FIELD_MOVER_*`, `FIELD_MAGNET_*`, `FIELD_LASER_*`, `FIELD_ICE_*` y materiales
  `steel`/`ice`), `js/audio.js` (`magnetHum`, `crackle`, `pulleyTick`, `laser`),
  `js/testlevels.js` (8 niveles ocultos nuevos), `README.md` (sección 4.11 y arquitectura) y este
  `contexto.md`.
- **Valores elegidos y por qué.** Pozos: `FIELD_WELL_K = 24`, `rmin = 24`, radio visual 90;
  `F = k·m/max(r,rmin)²` y a 100 px la aceleración (≈0.67 px/paso²) queda cerca de `g_step`.
  Zonas: `g` en px/paso², rango 0.02–1.60, fuerza `m·(g_zona−g_global)/STEP²`. Plataformas:
  estáticas recolocadas con `x(t)=x0+ax·sin(ωt+φ)` a 60 Hz; cargas con `mover: id` fijadas por
  offset local. Poleas: `a=(m1−m2)/(m1+m2)·g_step`, `T=2m1m2/(m1+m2)·g_step`; se evita
  `Matter.Constraint` porque empuja las masas al darle holgura, y se usan `vL+vR=0` y suma de
  desplazamientos constante. Imanes: `F=strength·m/r²` solo para `body.ferrous` o
  `birdFerrous`; `switchId`/`invert` permiten gobernarlos desde reactores. Láser: reflexión
  `d'=d−2(d·n)n`, hasta 8 rebotes (`FIELD_LASER_MAX_BOUNCE`) y alcance 1900 px. Térmica:
  `ΔT=Σ meltRate·(1−d/r)` por paso, máximo 100 (`FIELD_ICE_MAX_TEMP`), hielo con densidad 0.0009
  y `meltRate` por defecto 1.5.
- **Cómo se probó.** `node --check` sobre todos los `js/*.js`: OK. Navegador sin mensajes de
  consola. Los 8 niveles nuevos cargan y simulan 120 pasos sin excepciones. Atwood:
  `a_teórica = 0.094017` y `a_medida = 0.094017 px/paso²` (error ≈4e-12 %), con la medida
  congelada al llegar al suelo o a la rueda. Plataforma móvil: desviación de la carga `0 px`
  en 240 pasos.
  Láser: dos espejos iluminan `r1`; girar el espejo móvil `+0.35 rad` lo apaga; devolverlo lo
  enciende. Térmica: las dos columnas se derriten en unos 60 pasos (100 °C) y la plataforma
  cae de `y=520` a `y≈640`.
  Zonas: a los 30 pasos la caja de `g=0.16` está en `y=453.8` y la de `g=1.12` en `y=609.4`.
  Imanes: la caja de acero sube de `y=400` a `y=208` en 60 pasos. Predicción: 0 px de error en
  25 puntos para pozos, zonas, imanes y viento, sin crear cuerpos ni restricciones.
  Rendimiento de `combined` (pozos + zonas + plataforma): `1.5 ms` por `update+render`
  (≈650 fps equivalentes en la pestaña de prueba). Clásico (`startClassic(0)`) y Aventura
  (`getCampaignLevel(1,7)` + `startCampaignLevel`) cargan y simulan sin errores.
- **Problemas y soluciones.** (1) Los eventos de los módulos avanzados se perdían porque
  `pushEvent` escribía en `fieldState.events`, que no existía; ahora `Fields.create` comparte el
  array raíz y `takeEvents` lo vacía en el sitio. (2) La polea usaba constraints con
  `length = distancia + 24`; matter.js los interpreta como muelles bidireccionales y empujaban las
  masas (12 px/paso), así que se sustituyeron por tensión de Atwood + corrección de suma. (3) Las
  masas se colocaban 136 px a un lado del ancla y hacían péndulo; ahora cuelgan verticales de los
  bordes de la rueda. (4) La carga de una plataforma se hundía hasta 11 px por el choque con el
  objetivo; `Fields.afterUpdate` la reafirma después de `Engine.update`. (5) `targetLit` nunca
  volvía a `false`, así que el reactor quedaba encendido tras girar el espejo; ahora se recalcula
  desde cero en cada paso. (6) La predicción creaba cuerpos duplicados si se llamaba a
  `Fields.create` sin contexto; ahora `predict: true` evita crear plataformas, poleas, espejos o
  hielo.
- **Pendientes.** Llevar estos campos a niveles de campaña (hoy solo existen en los niveles ocultos
  de prueba), decidir su efecto en puntuación/estrellas y medir el coste con muchas piezas. Ver
  sección 7.

### [2026-10-25 16:33] Fase 4.12 — Proyectiles especiales

- **Qué se hizo.** Se completó la integración de normal, heavy, bounce, explosive, split y rocket:
  selector numérico/clicable, fila de munición con iconos y atenuación, predicción con las
  propiedades del tipo, marcas `×` para explosión/división, masa y momento en `V`, y acción de
  dividir por clic/toque/espacio, choque o temporizador. Los corazones añaden normal y las estrellas
  siguen contando tiros gastados. Se añadió la onda procedural que faltaba para renderizar la
  explosión y un nivel oculto de ocho tiros. `AMMO_TYPES` y los cuatro sonidos ya existían y no
  necesitaron cambios.
- **Archivos modificados.** `js/game.js`, `js/testlevels.js`, `README.md` y `contexto.md`.
- **Valores elegidos y por qué.** Se conservaron los datos existentes: normal `0,0085/0,32`;
  heavy radio `×1,15`, densidad `×2,2`, salida `×0,8`; bounce densidad `×0,8`, restitución `0,92`,
  fricción `0,12`; explosión `R=150`, umbral `3`; split a `±12°`, laterales `0,85·v`, centro
  `3−2·0,85·cos(12°)`, masa `m/3`; rocket empuje `0,22 px/paso²` durante 25 pasos. La fórmula del
  heavy no conserva energía: por su área y densidad, `m'/m=2,9095`, de modo que con `v'=0,8v`
  `E'/E=1,86208`. Se mantuvieron literalmente los multiplicadores pedidos y se explicó la
  discrepancia en README; energía constante exigiría `v'=0,586v`.
- **Cómo se probó.** `node --check` para los 12 archivos `js/*.js`: OK. `game.runAmmoTests()`:
  división con error de momento `1,00e-14 %`; explosión desplaza más el bloque cercano
  (276,02 px) que el lejano (258,95 px); heavy alcanza menos (915,52 frente a 1210,30 px) y
  empuja más la caja (176,65 frente a 14,26 px). En navegador: nivel oculto con 8 tiros e iconos;
  clic selecciona heavy, tecla `5` selecciona split, el lanzamiento/división produce tres cuerpos;
  cohete baja de 25 a 19 pasos de empuje en vuelo. `startClassic(0)` conserva 3 normales y
  `startCampaignLevel(1-7)` carga 4 normales. Predicción funciona para los seis tipos y dibuja
  marcador para explosive/split. Captura revisada: fila y selector legibles; sin errores de
  consola en la carga final. Una definición con `shots=3` y un solo tipo se rellenó con dos
  normales y emitió el aviso de longitud esperado.
- **Problemas y soluciones.** El puerto 8123 estaba ocupado; se probó con la instancia local en
  8124. Al probar la nueva onda de explosión, el render llamó a `drawWaves()` inexistente; se
  implementó el dibujo de anillos en `game.js`. Se corrigió la nota de energía para incluir el
  aumento de área del heavy. No se alteró guardado ni puntuación clásica.
- **Pendientes.** Los proyectiles aún no se asignan a niveles de campaña; solo el test oculto usa
  todos. La especificación de heavy conserva los factores solicitados, aunque contradicen energía
  constante. Continúan los pendientes de las fases Hardcore, Infinito y mundos 2–5.

### [2026-10-25 17:14] Temas, intensidad y plantillas (pre-Fase 3)

- **Qué se hizo.** Se añadieron cinco temas con paleta, tres capas de fondo procedural con parallax
  de presentación, partículas, color de reactor, suelo y ambiente WebAudio. `WORLDS[1..5]` ahora
  define tema, intensidad, mecánicas, jefe y 12 slots `{slot,nombre,concepto,template,params}`.
  `STRUCTURES` comparte los seis niveles clásicos; `TEMPLATES` implementa `structure`,
  `definition` y `construction`. El selector muestra miniaturas e iconos, usa cuadrícula 4×3 para
  niveles, y `?unlock=all` habilita temporalmente los placeholders. `game.startThemeTest(1..5)` da
  acceso a una escena con el ambiente y campo de cada mundo.
- **Archivos nuevos/modificados.** Nuevos: `js/themes.js`, `js/templates.js`. Modificados:
  `index.html`, `js/config.js`, `js/fields.js`, `js/campaign.js`, `js/screens.js`, `js/game.js`,
  `js/audio.js`, `README.md` y este `contexto.md`.
- **Valores elegidos y por qué.** `INTENSITY = [1, 1.25, 1.5, 1.75, 2]`. `scaleFields()` clona
  campos y escala viento (`fx`, `fy`, `gust`), pozos (`k`), agua (`drag`, `rise`, `riseMax` si se
  declaró), plataformas (`ax`, `ay`, `omega`), imanes (`strength`) y térmica (`meltRate`). Los
  valores de prueba son deliberadamente moderados; los placeholders de mundos 2–5 no pretenden
  ser niveles balanceados. Parallax y partículas dependen de `game.time`, nunca de `simStep`.
- **Cómo se probó.** `node --check` en los 14 JS: OK; editor sin errores en los ocho módulos
  afectados. En navegador, los 5 mundos y sus 60 slots cargan; 1-1 a 1-6 conservan estructura y
  disponibilidad, 1-7 a 1-12 siguen jugables y 2–5 están marcados `ready: false`. La prueba de
  intensidad confirmó los factores 1.25/1.5/1.75/2 en campos activos. `?unlock=all` abre 5-7 y
  permite `startThemeTest` para los cinco temas; el puntero y las flechas cambian la previsualización
  y el perfil ambiente. Con viento en el test del Cañón, el error de predicción frente al vuelo real
  fue `1,5e-12 px`; progreso en `SAVE_KEY` no cambió. Desbloqueo
  aislado con `Progress` de prueba llega de mundo 1 a 5. Clásico restaura cielo azul (pixel
  `108,187,230`), 3 tiros normales, sin tema ni audio ambiente; resolución lógica `1280×720`.
  Navegador: sin errores de consola, miniaturas revisadas, ocho nodos WebAudio, 58 actualizaciones
  temáticas frente a 59 en Clásico por segundo en el entorno de prueba.
- **Problemas y soluciones.** Una miniatura de pradera dibujaba colinas fuera de su marco; se
  añadió recorte de canvas. Al regresar de Orbit/Fábrica, el modo Clásico podía conservar el cielo
  temático; ahora restaura su bitmap y silencia el ambiente. La prueba de mute dejó temporalmente
  `MUTE_KEY='0'` donde antes no había dato; se restauró la clave a ausente. `?unlock=all` es
  temporal y no modifica `Progress`.
- **Pendientes.** Diseñar y balancear 48 niveles de los mundos 2–5, conectar sus campos/munición a
  contenido real y probar en hardware a 60 Hz. Mantener los niveles actuales del Mundo 1 y el
  guardado Clásico intactos.

### [2026-10-25 18:50] Campaña de cinco mundos (implementación y humo)

- **Qué se hizo.** Se sustituyeron los slots vacíos de los cinco mundos por 60 niveles basados en
  plantillas de lección/jefe. Cada slot declara tiros, par, munición, campos, objetivo, cuerpos,
  corazones y, para los jefes, vida, posiciones y efectos. Se añadieron las mecánicas especiales
  de nivel 10 por mundo, combos con campos y dos reactores en nivel 11, y jefes con tres golpes.
  Mundo 1 usa contenido de Aventura propio; los seis niveles de Clásico permanecen en `levels.js`.
- **Archivos tocados.** `js/campaign.js`, `js/templates.js`, `js/game.js`, `js/fields.js`,
  `js/fields-advanced.js`, `README.md` y `contexto.md`.
- **Valores y criterios.** Intensidad `[1, 1.25, 1.5, 1.75, 2]`; tiros/par: niveles 1–5 `3/2`,
  6–10 `4/3`, nivel 11 `6/5` y jefes `6/4`. Munición declarada en orden: 1–5 normal, normal,
  pesada; 6–9 normal, pesada y dos rebotes; 10 añade explosiva; 11–12 añaden split y rocket.
  Cada mundo suma 60 estrellas. Los valores siguen el ritmo uniforme pedido y dejan el par del
  jefe en 4 para el sistema de tres golpes.
- **Pruebas.** `node --check` pasó en todos los `js/*.js`. El navegador cargó los 60 niveles,
  ejecutó 30 pasos fijos por nivel sin victoria/derrota ni cuerpos/objetivos colapsados durante
  la gracia; después cargó Clásico 1 en estado `ready`. Canvas lógico observado: `1280×720`;
  sin errores de consola ni excepciones de página en la carga. El número de canvas permaneció
  constante al recorrer los 60 niveles y alternar Clásico/Aventura. Esto no es una prueba de
  victoria ni de solución para los niveles. No se completó una partida de Clásico ni se verificó
  el flujo íntegro de guardado/desbloqueo en esta tanda.
- **Problemas y soluciones.** El humo detectó victoria automática en los niveles de poleas porque
  el reactor recibía una masa antes del primer disparo; la plantilla ahora usa objetivos de
  destrucción independientes. En 2-10 la plantilla sobreescribía el objetivo `destroyAll` de los
  datos con `switch`, lo que permitía victoria inicial; ahora respeta el objetivo declarado.
  Las semillas de entidades/corazones y partículas de `game.js` ahora derivan del mundo, nivel,
  posición y paso, sin `Math.random()` para esos efectos. Las cargas sucesivas estaban dejando
  canvas de `p5.Graphics` de fondo sin liberar; `buildSky()` ahora elimina el gráfico anterior.
- **Soluciones de referencia.** Ninguna solución está certificada como ganadora en esta fase.
  No registrar ángulos/potencias/proyectiles como soluciones hasta reproducir una victoria real.
- **Pendiente.** Encontrar y probar una secuencia de tiros ganadora para cada uno de los 60
  niveles; verificar los cuatro jefes golpe a golpe, estrellas y desbloqueo, revisar los pares y
  completar la prueba de juego de Clásico y Aventura.
- **Guardado de prueba.** Se quitaron únicamente los registros de nivel creados por las pruebas
  de victoria automática (`1-4`, `2-4`, `2-10`, `3-4`, `4-4`, `5-4`) de `adventure.levels`.
  Se conservaron el resto del objeto v2, los desbloqueos, todos los récords Clásicos y el registro
  `5-12`, cuyo origen no se pudo confirmar.

### [2026-10-25 19:47 -05:00] Fase 6 — Simulador, ajuste de pares y cierre automático

- **Qué se hizo.** Se cerró la validación determinista de los 60 niveles, se corrigieron los casos
  rojos 2-5 y 2-9, se aplicaron los pares sugeridos en datos de campaña y se regeneró el informe.
  Las 60 filas quedaron `OK`, sin soluciones ausentes, autodestrucción en gracia ni trivialidad
  según los umbrales del informe.
- **Archivos tocados en esta fase.** `js/campaign.js`, `js/templates.js`, `tools/sim.js`,
  `docs/validacion.md`, `README.md` y `contexto.md`. No se tocó `js/levels.js` ni el
  comportamiento de Clásico.
- **Valores elegidos y por qué.** Se conservó el ritmo de tiros `3/4/6/6` por slots
  `1–5/6–10/11/12`; los pares por mundo están en 5.6. Se aplicó
  `clamp(minShots, shots − 2, shots − 1)`, para dar 5 estrellas con soluciones encontradas sin
  exceder el par solicitado. La cuadrícula completa fue 5°–85° cada 1,5°, ocho potencias
  40–100 % y cada munición disponible en el primer tiro.
- **Pruebas.** `node tools/tests.js`: pasó (60 definiciones y repetición idéntica). `node
  tools/sim.js --all`: 60/60 `OK`, informe actualizado; la secuencia de pruebas más validación tardó
  **152,81 s** en este equipo, por debajo del límite de 15 min. Se comprobó la consistencia entre los 60 pares de `README.md` y
  `CAMPAIGN_LEVELS`. En navegador: Clásico abre el nivel 1 en `ready` con 3 tiros; Aventura carga
  2-1; consola sin errores.
- **Coincidencia manual simulador/navegador (3 casos).**
  1. 2-1, 30,5° / 91,428571 % / normal: victoria en 1 tiro, 1320 puntos y 64 pasos tanto en
     `simulate` como en `Game.update()` del navegador.
  2. 1-6, 39,86° / 92,08 % / bounce: ambos dieron 210 puntos y dejaron un objetivo; no se anotó
     como victoria.
  3. 1-6, 80° / 40 % / normal: ambos dieron 0 puntos, sin victoria ni autodestrucción.
- **Problemas y soluciones.** Una primera comprobación de 2-1 redondeó la potencia a 91,4 % y
  obtuvo una trayectoria distinta. Se repitió usando el valor exacto de la malla
  (`0.9142857143`), con coincidencia de estado, puntuación y pasos. Los niveles 2-5 y 2-9 se
  corrigieron con campos más débiles, manteniendo sus conceptos físicos; los detalles están en
  la sección 6.
- **Pendiente.** Playtesting humano de los 60 niveles, recorrido completo de estrellas/desbloqueos
  y validación visual manual de los tres golpes de cada jefe. La solución voraz no prueba mínimos
  globales; el informe explicita esta limitación.

### [2026-10-25 20:42 -05:00] Fases 4–5 — Hardcore e Infinito (primera implementación)

- **Qué se hizo.** Hardcore juega la campaña en orden, no permite reiniciar con `R`, exige el
  mínimo configurable de 3 estrellas, elimina tiros sobrantes al cambiar de nivel y guarda récord,
  historial de diez runs y checkpoint del nivel siguiente superado. Infinito genera niveles con
  subsemilla determinista, presupuesto, temas, campos, mutadores y jefes cada diez niveles; valida
  estabilidad/solución/trivialidad usando `Game.update()` en modo headless y prepara el siguiente
  nivel sin bloquear el render. Se añadieron semilla aleatoria, decimal/hexadecimal, diaria y
  compartir, así como ranking global y por semilla. La tabla v2 conserva el progreso ya existente.
- **Archivos tocados.** `index.html`, `css/style.css`, `js/config.js`, `js/rng.js`, `js/progress.js`,
  `js/screens.js`, `js/game.js`, `js/core.js` (nuevo), `js/generator.js` (nuevo), `tools/sim.js`,
  `tools/tests.js` y `README.md`.
- **Valores elegidos y por qué.** Hardcore: 3 estrellas por nivel, +100 por nivel y +200 por jefe;
  los puntos por golpe de jefe se duplican. Infinito: 3 tiros de reserva inicial, tope 5, presupuesto
  `min(40, 4 + 0.9 × índice)`, intensidad `min(2.5, 1 + 0.035 × índice)`, malla 24 × 4, hasta 12
  intentos y un mutador determinista por bloque de cinco niveles. La generación en navegador cede
  cada 30 pasos a `requestAnimationFrame`; se acepta un nivel solo si no se altera durante la gracia,
  se encuentra una ruta ganadora y la tasa de victorias de un tiro no supera 25 %. La plantilla de
  respaldo también se simula. La semilla diaria es FNV-1a de la fecha local `AAAA-MM-DD`.
- **Pruebas realizadas.** `node tools/tests.js`: OK (60 niveles de campaña, repetición bit a bit
  del simulador, 30 definiciones deterministas, presupuesto, persistencia corrupta/bloqueada,
  historial Hardcore y ranking por semilla). `node tools/sim.js --level 2-1 --quick --json`: OK.
  El tiro de referencia 2-1 (`30.5°`, `0.9142857142857143`, normal) dio victoria, 1320 puntos y
  64 pasos. En navegador se verificó la carga de `index.html` (canvas, `generate()` y
  `simulateLevel()` presentes, sin error de carga) y que Hardcore inicia en 1-1 con el guardado v2.
  En Node se validaron respaldos de jefes de 3 golpes en mundos 2–5 y un caso de jefe generado que
  derrota al sensor en 4 tiros.
- **Problemas y soluciones.** Al extraer el simulador, el contexto inicial se marcó como Aventura
  para conservar los campos/temas del flujo anterior; Infinito pasa `mode: 'infinite'` explícito.
  El ejecutor Node necesitó exponer `setTimeout` al contexto VM para ceder durante la búsqueda.
  Las rutas de respaldo de jefes conservan un efecto temático por mundo para que un fallback no
  elimine la mecánica especial. El guardado del navegador se usó temporalmente durante una prueba
  automatizada y se restauró al estado inicialmente vacío.
- **Pendientes / límites.** No se ha corrido el lote completo de aceptación de 50 niveles para cada
  una de cinco semillas (250 validaciones), no se completó un run de Hardcore hasta el nivel 60 y
  no se verificó visualmente compartir/clipboard ni cada mutador y transición de jefe en navegador.
  La búsqueda de secuencias es heurística; la plantilla fallback asegura un nivel básico, pero
  puede reducir la variedad procedural. Las comprobaciones de UI/manuales siguen pendientes.

### [2026-10-25 21:35 -05:00] Cierre de Fases 4–5 — Hardcore, Infinito y aceptación 250

- **Qué se hizo.** Se cerró el flujo de Hardcore (run de 60 niveles en orden, una vida, sin `R`,
  mínimo de 3 estrellas, corazones que solo añaden tiros dentro de su nivel, puntuación de jefe
  duplicada, récord e historial de diez runs y checkpoint para **CONTINUAR**). En Infinito se
  terminó la derrota con recapitulación antes del ranking, se protegieron las carreras obsoletas y
  los errores de precarga, y se corrigió el generador: los tiros se derivan de los objetivos reales,
  `meta.fields` describe los campos cargados, la afinidad de munición no elimina herramientas
  únicas y la munición limitada descarta el proyectil básico en vez del cohete. `SimulationJob`
  reenvía gravedad, masa, mutador y reserva a `loadLevel`, de modo que validación y partida usan
  la misma física. Los jefes de Infinito ahora se validan con secuencias adaptativas y conservan la
  intensidad base de su mundo.
- **Archivos tocados.** `js/generator.js`, `js/game.js`, `js/core.js`, `js/screens.js`,
  `js/progress.js`, `tools/tests.js`, `README.md` y `contexto.md`. No se modificaron
  `js/levels.js`, la clave `resortera_vs_torre_save_v2` ni la puntuación de Clásico.
- **Valores y decisiones.** Hardcore mantiene `HARDCORE_MIN_STARS = 3`, +100 por nivel y +200 por
  jefe. Infinito conserva reserva inicial 3 y tope 5, presupuesto `min(40, 4 + 0.9 × índice)`,
  intensidad de profundidad `min(2.5, 1 + 0.035 × índice)` para niveles normales y malla 24 × 4.
  Los jefes usan una sola validación (sus doce intentos eran idénticos), la intensidad base del
  mundo (`[1, 1.25, 1.5, 1.75, 2]`) y una búsqueda acotada de hasta 900 simulaciones que cambia
  ángulo, potencia y munición tras cada teletransporte. La munición limitada descarta el primer
  proyectil y conserva cohete/split. La derrota de Infinito muestra semilla, profundidad, estrellas,
  corazones, puntaje y mejor marca antes de abrir el ranking.
- **Pruebas realizadas.** `node tools/tests.js`: OK (campaña, determinismo, 150 definiciones de
  Infinito, mutadores reenviados, munición/objetivos/metadatos, jefes con intensidad base,
  persistencia corrupta/bloqueada, historial y récord de Hardcore, ranking por semilla).
  `node --check` en los JS modificados: OK. Lote de aceptación de **5 semillas × 50 niveles**:
  **250/250 válidos en el primer intento, 0 fallos, 0 respaldos, 155,7 s**; el más lento tardó
  4,5 s (semilla 1, nivel 26). En navegador: menú y Clásico 1 sin errores; Hardcore empieza en 1-1,
  una derrota borra el checkpoint, un corazón en 1-9 sube `shotsMax` de 4 a 5, la victoria forzada
  de los 60 niveles muestra «¡Campaña completada!» y la pantalla conserva récord e historial;
  Infinito con semilla `20261025` carga, encadena victorias, muestra la recapitulación al perder y
  el clic/Enter/Espacio abre el ranking con la entrada guardada. Consola del navegador limpia.
- **Problemas y soluciones.** Todos los jefes generados caían al respaldo porque la validación
  repetía el mismo ángulo tras cada teletransporte; se sustituyó por una búsqueda de secuencias con
  munición y potencia variables. Los jefes del mundo 3 a profundidad 40 eran imposibles porque el
  agua de campaña se escalaba a 2,4×; ahora los jefes usan la intensidad base de su mundo. Doce
  intentos idénticos por jefe alargaban el respaldo más de 10 s; se redujeron a uno. La derrota de
  Infinito abría el ranking demasiado pronto y ocultaba el resumen; ahora hay recapitulación y luego
  ranking. La munición limitada podía dejar al jugador sin cohete; se descarta el primer proyectil.
- **Pendientes / límites.** Falta una run manual completa de Hardcore, playtesting humano de
  variedad/dificultad de Infinito, verificación visual de compartir semilla y ranking en más
  navegadores, y el rendimiento del agua con muchas piezas. La búsqueda sigue siendo heurística y
  no demuestra un mínimo global; la plantilla de respaldo se conserva como red de seguridad. Los
  temporizadores de presentación siguen usando el `dt` del render, aunque la física es de paso fijo.

## 4. Mapa de archivos

> No hay historial git. La columna “fase” es una **atribución aproximada** a partir de las
> responsabilidades y de lo que el README atribuye a la fase 3. Los archivos base existían antes de
> crear este documento; `contexto.md` es el único creado en esta fase.

| Archivo | Responsabilidad | Estado / fase |
|---|---|---|
| `index.html` | Estructura mínima y orden de carga de libs y scripts | Creado en la base clásica; incluye temas y plantillas |
| `css/style.css` | Fondo, centrado y escalado 16:9 del canvas | Creado en la base clásica (fase 1A, inferido) |
| `js/config.js` | Constantes de física, materiales, puntuación, guardado, `INTENSITY` y `useText()` | Ampliado con campos y temas |
| `js/themes.js` | Paletas, capas visuales, partículas, suelo y perfiles WebAudio de los cinco mundos | Creado en fase de temas y plantillas |
| `js/levels.js` | Los 6 niveles clásicos como datos, incluidos reactores, cuerda, palanca y dominó de 4–6 | Creado en fase 1A; ampliado con mecanismos en fase 1C (inferido) |
| `js/fields.js` | Registro de campos, viento, agua (geometría sumergida exacta), dibujo, overlay, HUD, eventos y ganchos `drawBack`/`afterUpdate`/`checkCuts` | **Creado en la fase de campos (2026-10-25)**; ampliado en la fase 3.6 |
| `js/fields-advanced.js` | Pozos, zonas de gravedad, plataformas móviles, poleas, imanes, láser/espejos y térmica | **Creado en la fase 3.6 (2026-10-25)** |
| `js/testlevels.js` | Niveles ocultos de prueba (`wind`, `water`, `wells`, `gravityZones`, `movers`, `pulleys`, `magnets`, `lasers`, `thermal`, `combined`) | **Creado en la fase de campos (2026-10-25)**; ampliado en la fase 3.6 |
| `js/testlevels.js` | Niveles ocultos de campos y proyectiles | Creado en fase campos; ampliado en 3.6 y 4.12 |
| `js/templates.js` | `STRUCTURES` clásicas reutilizables y funciones `TEMPLATES` | Creado en fase de temas y plantillas |
| `js/campaign.js` | `WORLDS[1..5]`, intensidades, jefes y 60 slots de plantilla | Reestructurado en fase de temas y plantillas; Mundo 1 preservado |
| `js/rng.js` | `mulberry32`, `hash32`, semilla diaria, decimal/hexadecimal y `makeRng` | Ampliado en fase 5 |
| `js/progress.js` | Guardado v2: niveles, runs de Hardcore, checkpoint y ranking global/por semilla | Ampliado en fases 4–5 |
| `js/core.js` | `SimulationJob` y `simulateLevel()` headless, compartidos con el juego | Creado en fases 4–5 |
| `js/generator.js` | Generador procedural determinista, presupuesto, mutadores y validador Infinito | Creado en fase 5 |
| `js/audio.js` | `Sfx`: efectos y bucles ambiente sintetizados, mute persistido | Ampliado con perfiles por mundo |
| `js/screens.js` | Menús, miniaturas temáticas, iconos de mecánicas, cuadrícula 4×3 y navegación | Ampliado en fase de temas y plantillas |
| `js/game.js` | Motor y render; tema, intensidad, parallax, transición y pruebas ambientales | Ampliado en fase de temas y plantillas |
| `js/sketch.js` | `setup()`/`draw()` de p5 y conversión de eventos de puntero a coordenadas del lienzo | Creado en fase 1A (inferido) |
| `serve.js` | Servidor estático opcional de Node para probar en `http://localhost:8123` | Creado en fase 1A (inferido) |
| `docs/01-inicio.png` | Captura del menú/inicio con la pista del primer disparo | Añadido en fase 3 (inferido) |
| `docs/02-apuntando.png` | Captura de la trayectoria prevista al apuntar | Añadido en fase 3 (inferido) |
| `docs/03-impacto.png` | Captura de impacto, partículas y derrumbe | Añadido en fase 3 (inferido) |
| `docs/04-nivel3.png` | Captura del nivel 3, “La fortaleza” | Añadido en fase 3 (inferido) |
| `docs/05-nivel4.png` | Captura del nivel 4, “El peso colgante” | Añadido en fase 3 (inferido) |
| `docs/05-victoria.png` | Captura de victoria; no está referenciada en el README actual | Añadido en fase 3 (inferido) |
| `docs/06-nivel5.png` | Captura del nivel 5, “La catapulta” | Añadido en fase 3 (inferido) |
| `docs/07-nivel6.png` | Captura del nivel 6, “Dominó” | Añadido en fase 3 (inferido) |
| `docs/08-fisica.png` | Captura del overlay de física con `V` | Añadido en fase 3 (inferido) |
| `lib/p5.min.js` | Librería p5.js local | Vendorizada en fase 1A (inferido) |
| `lib/matter.min.js` | Librería matter.js local | Vendorizada en fase 1A (inferido) |
| `README.md` | Documentación de juego, física, arquitectura y limitaciones | Creado/actualizado en fases 1A–3 y en la fase de campos (inferido) |
| `contexto.md` | Memoria viva del proyecto; este archivo | **Creado en la fase 0 (2026-10-25)** |

## 5. Parámetros y valores de balance

> Todos los valores de esta sección se verificaron en el código y en el navegador. Si se cambia uno,
> hay que actualizar también esta tabla y `README.md`.

### 5.1 Constantes de simulación y resortera (`config.js`)

| Constante | Valor | Uso |
|---|---:|---|
| `WIDTH` | 1280 | Ancho lógico |
| `HEIGHT` | 720 | Alto lógico |
| `GROUND_Y` | 650 | Borde superior del suelo |
| `GRAVITY` | 2.2 | Gravedad de matter.js (≈ 2,5 g estilizadas) |
| `STEP_MS` | 1000 / 60 ≈ 16,6667 ms | Paso fijo de física |
| `MAX_STEPS` | 4 | Pasos máximos por frame |
| `INTENSITY` | `[1.0, 1.25, 1.5, 1.75, 2.0]` | Factor de campos para mundos 1–5 |
| `FORK.x` / `FORK.y` | 215 / 470 | Punto de la horqueta |
| `MAX_STRETCH` | 125 px | Estiramiento máximo de la goma |
| `MIN_STRETCH` | 18 px | Por debajo se cancela el disparo |
| `MAX_SPEED` | 26 px/paso | Velocidad máxima al soltar |
| `BIRD_RADIUS` | 17 px | Radio del proyectil |
| `GRAB_RADIUS` | 165 px | Radio de agarre alrededor de la horqueta |
| `DAMAGE_K` | 0.42 | Factor global de daño |
| `MIN_IMPACT_SPEED` | 3.0 px/paso | Choques por debajo no cuentan |
| `MIN_DAMAGE` | 1.5 | Daño mínimo aplicado |
| `GRACE` | 0.6 s | Ventana sin daño al asentar |
| `RELOAD` | 0.55 s | Espera antes del siguiente tiro |
| `SETTLE` | 2.2 s | Espera tras el último tiro antes de perder |
| `MAX_FLIGHT` | 7.0 s | Un tiro “eterno” se da por terminado |
| `REST_SPEED` | 0.9 px/paso | Velocidad considerada reposo |
| `ROPE_CUT_PAD` | 10 px | Margen del segmento barrido de la cuerda |
| `ROPE_CUT_SPEED` | 4 px/paso | Velocidad mínima para cortar |
| `SWITCH_MIN_SPEED` | 3.0 px/paso | Velocidad mínima para activar un reactor |
| `SWITCH_MIN_MASS` | 0.5 | Masa mínima para activar un reactor |
| `LEVER_ANGLE` | 0.20 rad | Giro que activa una palanca |
| `DOMINO_ANGLE` | 0.42 rad | Giro que cuenta una ficha derribada |
| `FIELD_WIND_C` | 6.4e-8 | Coeficiente de fuerza del viento por área |
| `FIELD_WIND_MAX_FORCE` | 0.02 | Tope de fuerza por cuerpo y paso (seguridad) |
| `FIELD_PREDICT_STEPS` | 150 | Pasos máximos de la línea de puntos |
| `FIELD_SPLASH_SPEED` | 2.5 px/paso | Velocidad mínima para generar chapoteo |
| `FIELD_WATER_DENSITY` | 0.0040 | Densidad por defecto del agua |
| `FIELD_WATER_DRAG` | 0.085 | `frictionAir` extra con el cuerpo sumergido |
| `FIELD_WATER_ANGULAR_DAMP` | 0.30 | Amortiguación angular dentro del agua |
| `FIELD_WELL_K` | 24 | Constante de fuerza de pozos (`F = k·m/r²`) |
| `FIELD_WELL_RMIN` | 24 px | Radio mínimo para evitar la singularidad |
| `FIELD_WELL_RADIUS` | 90 px | Radio visual del pozo |
| `FIELD_ZONE_MIN_G` / `FIELD_ZONE_MAX_G` | 0.02 / 1.60 px/paso² | Límites de las zonas de gravedad |
| `FIELD_MOVER_FRICTION` | 1.0 | Fricción de las plataformas móviles |
| `FIELD_MAGNET_STRENGTH` | 18 | Fuerza por defecto de un imán |
| `FIELD_MAGNET_RMIN` | 22 px | Radio mínimo del imán |
| `FIELD_MAGNET_RADIUS` | 62 px | Radio visual del imán |
| `FIELD_LASER_MAX_BOUNCE` | 8 | Rebotes máximos del rayo |
| `FIELD_LASER_RANGE` | 1900 px | Alcance máximo del rayo |
| `FIELD_ICE_MAX_TEMP` | 100 | Temperatura de derretimiento |
| `FIELD_ICE_MELT_RATE` | 1.5 | Calor por paso y por fuego (por defecto) |
| `FIELD_PX_PER_METER` | 90 px | Escala para mostrar aceleraciones en m/s² |
| `SCORE_TARGET` | 100 | Objetivo destruido |
| `SCORE_BLOCK` | 10 | Bloque destruido |
| `SCORE_SHOT_BONUS` | 50 | Por tiro no usado al ganar |
| `SCORE_MECHANISM` | 25 | Cuerda cortada o palanca activada |
| `SCORE_SWITCH` | 100 | Reactor activado |
| `SCORE_DOMINO` | 5 | Ficha de dominó derribada |
| `SCORE_STAR` | 200 | Bonus por estrella (solo modos nuevos) |
| `SCORE_HEART` | 150 | Corazón recogido |
| `SCORE_BOSS_HIT` | 250 | Golpe válido al jefe (se duplica en Hardcore) |
| `HARDCORE_MIN_STARS` | 3 | Estrellas mínimas para avanzar en Hardcore |
| `HARDCORE_LEVEL_BONUS` | 100 | Bonus por nivel superado en Hardcore |
| `HARDCORE_BOSS_BONUS` | 200 | Bonus por jefe superado en Hardcore |
| `INFINITE_STARTING_RESERVE` | 3 | Reserva inicial de tiros de Infinito |
| `INFINITE_MAX_RESERVE` | 5 | Tope de tiros que se arrastran en Infinito |
| `INFINITE_VALIDATION_ATTEMPTS` | 12 | Intentos antes de usar la plantilla de respaldo |
| `BEST_KEY` | `resortera_vs_torre_best` | Récord antiguo (compatibilidad; no se migra todavía) |
| `SAVE_KEY` | `resortera_vs_torre_save_v2` | Progreso nuevo por nivel |
| `MUTE_KEY` | `resortera_vs_torre_mute` | Preferencia de silencio |

### 5.2 Materiales (`config.js`)

| Material | Densidad | Fricción | Restitución | Vida (`hp`) | Fragilidad (`damageMult`) |
|---|---:|---:|---:|---:|---:|
| Madera (`wood`) | 0.0024 | 0.62 | 0.08 | 58 | 1.0 |
| Piedra (`stone`) | 0.0060 | 0.85 | 0.04 | 320 | 0.45 |
| Vidrio (`glass`) | 0.0016 | 0.22 | 0.05 | 32 | 2.4 |
| Dominó (`domino`) | 0.0017 | 0.58 | 0.02 | 200 | 0.2 |
| Proyectil (`bird`) | 0.0085 | 0.60 | 0.32 | — | — |
| Objetivo (`TARGET`) | 0.0022 | 0.70 | 0.05 | 14 | 1.5 |

- El proyectil usa además `frictionAir = 0.004`.
- **Sobrescrituras por pieza:** la palanca del nivel 5 y del 1-11 usa `density: 0.0007`; el bloque
  lanzado por esa palanca usa `density: 0.0012`. La palanca pesada no giraba lo bastante rápido y
  el bloque resbalaba en vez de salir despedido.
- El dominó tiene mucha vida y poca fragilidad: está pensado para volcar, no para romperse.

### 5.3 Campos (viento y agua)

Los campos se declaran en el nivel y los consume `js/fields.js`; sin `fields`, `Fields.apply()` no
toca ningún cuerpo.

**Viento** (`fields.wind`)

| Clave | Valor por defecto / prueba | Uso |
|---|---:|---|
| `fx` | `1.0` en `TEST_LEVELS.wind` | Velocidad base del viento en px/paso |
| `fy` | `0` | Componente vertical |
| `gust` | `0` en la prueba; `0.35` en el ejemplo del README | Amplitud de la ráfaga |
| `period` | `0` en la prueba; `180` pasos en el ejemplo | Periodo de la ráfaga |
| `drag` | `true` | `F = c·A·(v_viento − v)`; con `false`, `F = c·A·v_viento` |

- `F` es proporcional al **área** del cuerpo: un cuerpo ligero acelera más.
- `c = FIELD_WIND_C = 6.4e-8`; la fuerza se limita a `FIELD_WIND_MAX_FORCE = 0.02` por cuerpo y paso.
- Calibración: proyectil normal, potencia 100 % y 45°. Con `fx = 1.0`, `drag: true` y sin ráfagas, a
  los 53 pasos (800 px del tiro sin viento) el desvío es **48,7 px** euclídeos / 45,1 px
  horizontales. Objetivo: 30–60 px.
- Ráfaga determinista: `1 + gust · sin(2π · step / period)`, con `step` entero de 1/60 s.
- El HUD muestra fuerza en m/s usando `1 px/paso ≈ 0,67 m/s`.

**Agua** (`fields.water`)

| Clave | Valor por defecto / prueba | Uso |
|---|---:|---|
| `y` | `540` en `TEST_LEVELS.water` | Cota de la superficie |
| `density` | `0.0040` (`FIELD_WATER_DENSITY`) | Densidad del fluido |
| `drag` | `0.085` (`FIELD_WATER_DRAG`) | `frictionAir` extra con el cuerpo sumergido |
| `rise` | `0` | px que sube la superficie por paso |
| `riseMax` | `0` | Subida máxima acumulada |

- La fracción sumergida es exacta: segmento circular para círculos y recorte de polígono con
  centroide para cajas, palancas y fichas.
- `F_empuje = density · A · fracción · g · 0,001`, aplicado en el centro de la parte sumergida
  (genera par). El factor 0,001 es la escala de fuerza de matter.js.
- La amortiguación angular es `FIELD_WATER_ANGULAR_DAMP · fracción`.
- Equilibrio medido: vidrio ≈40 % sumergido (fracción 0,401), madera ≈60 % (0,600), piedra y
  proyectil se hunden. El proyectil pasa de 18,5 px/paso a 1,2 px/paso en ~20 pasos.
- `FIELD_SPLASH_SPEED = 2.5 px/paso` dispara burbujas y `Sfx.splash`.

**Predicción y overlay**

- La predicción clona un proyectil virtual y aplica los mismos `Fields.apply` paso a paso; se detiene
  en el primer choque sólido, en la superficie del agua o a los `FIELD_PREDICT_STEPS = 150` pasos.
  Con viento, el error máximo medido fue `3,5e-12 px` en 48 puntos.
- El overlay `V` dibuja flechas de viento, empuje (`E`) y peso (`P`) en el agua, y añade `Wcampos`
  al panel de energía. `Wcampos` se calcula como `ΔEc − Wgravedad`; con campos, `Ec + Ep` deja de
  conservarse y así se indica.

**Otros campos**

| Campo | Estado |
|---|---|
| Pozos de gravedad y repulsores | Implementado (`wells`, `js/fields-advanced.js`) |
| Zonas de gravedad local | Implementado (`gravityZones`) |
| Plataformas móviles con carga | Implementado (`movers`); la carga no resbala |
| Poleas y contrapesos | Implementado (`pulleys`); Atwood medido con `game.measureAtwood()` |
| Imanes | Implementado (`magnets`), solo cuerpos ferrosos |
| Láser y espejos | Implementado (`lasers`), reactor gobernado por iluminación |
| Térmica | Implementado (`thermal`), hielo que se derrite y libera la carga |
| Proyectiles especiales | Implementado en `game.js` con seis tipos declarativos `AMMO_TYPES`; nivel de prueba `ammo` |

### 5.4 Intensidad por mundo

`INTENSITY = [1.0, 1.25, 1.5, 1.75, 2.0]`. `Fields.scaleFields(fields, intensity)` hace una copia
profunda y escala viento (`fx`, `fy`, `gust`), pozos (`k`), agua (`drag`, `rise`, `riseMax` si se
declara), plataformas (`ax`, `ay`, `omega`), zonas de gravedad, resonancia, imanes (`strength`) y
térmica (`meltRate`). No cambia la gravedad global, daño, masa, tiros, par ni puntuación. El modo
Clásico usa intensidad 1 y no declara campos.

### 5.5 Par y tiros por nivel

**Clásico** (`js/levels.js`; el par se calcula como `shots - 1`):

| Nivel | Nombre | Tiros | Par | Objetivo |
|---:|---|---:|---:|---|
| 1 | El establo | 3 | 2 | `destroyAll` |
| 2 | Doble torre | 4 | 3 | `destroyAll` |
| 3 | La fortaleza | 4 | 3 | `destroyAll` |
| 4 | El peso colgante | 3 | 2 | `switch` |
| 5 | La catapulta | 3 | 2 | `switch` |
| 6 | Dominó | 3 | 2 | `switch` |

En Aventura todos los mundos tienen el mismo ritmo base: 1–5 (3 tiros), 6–10 (4 tiros), 11 combo
(6 tiros) y 12 jefe (6 tiros). Los pares de campaña se ajustaron con los tiros mínimos encontrados
por el simulador, acotados entre `shots − 2` y `shots − 1`. Munición por orden de uso: 1–5
`normal, normal, heavy`; 6–9 `normal, heavy, bounce, bounce`; 10 `normal, heavy, bounce,
explosive`; 11–12 añaden `split, rocket`. Cada slot declara su munición.

| Mundo | Nivel | Nombre | Mecánica |
|---|---:|---|---|
| 1 Pradera | 1 | Deriva en la pradera | Viento y deriva por masa |
| 1 Pradera | 2 | La poza tranquila | Flotabilidad y arrastre |
| 1 Pradera | 3 | Ritmo de la meseta | Plataforma oscilante |
| 1 Pradera | 4 | Contrapesos gemelos | Polea de Atwood |
| 1 Pradera | 5 | Pozo de gravedad | Pozo y zona gravitatoria |
| 1 Pradera | 6 | Impacto pesado | Demolición y momento |
| 1 Pradera | 7 | Cadena al viento | Dominós, reactor y viento |
| 1 Pradera | 8 | Péndulo del roble | Péndulo y plano inclinado |
| 1 Pradera | 9 | Corazón entre campos | Corazón, viento y pozo |
| 1 Pradera | 10 | Ruedas y rampas | Fricción e inercia rotacional |
| 1 Pradera | 11 | Gran reacción | Combo y dos reactores |
| 1 Pradera | 12 | El guardián | Jefe: teletransporte y obstáculos |
| 2 Cañón | 1 | Brisa de las dunas | Viento y deriva por masa |
| 2 Cañón | 2 | La poza del cañón | Flotabilidad y arrastre |
| 2 Cañón | 3 | Meseta oscilante | Plataforma oscilante |
| 2 Cañón | 4 | Atwood de piedra | Polea de Atwood |
| 2 Cañón | 5 | Vórtice del desierto | Pozo y zona gravitatoria |
| 2 Cañón | 6 | Asedio de arena | Demolición y momento |
| 2 Cañón | 7 | Dominó de la garganta | Dominós, reactor y viento |
| 2 Cañón | 8 | Péndulo de la mina | Péndulo y energía |
| 2 Cañón | 9 | Oasis de dos corrientes | Corazón, viento y pozo |
| 2 Cañón | 10 | Espejo del mediodía | Láser/espejos y péndulo de Newton |
| 2 Cañón | 11 | Tormenta encadenada | Combo y dos reactores |
| 2 Cañón | 12 | El centinela del viento | Jefe: viento cambia en cada golpe |
| 3 Puerto | 1 | Brisa del puerto | Viento y deriva por masa |
| 3 Puerto | 2 | Marea de cristal | Flotabilidad y arrastre |
| 3 Puerto | 3 | Plataforma de coral | Plataforma oscilante |
| 3 Puerto | 4 | Contrapeso de marea | Polea de Atwood |
| 3 Puerto | 5 | Pozo abisal | Pozo y zona gravitatoria |
| 3 Puerto | 6 | Impacto en el muelle | Demolición y momento |
| 3 Puerto | 7 | Dominó de la corriente | Dominós, reactor y agua |
| 3 Puerto | 8 | Péndulo del faro | Péndulo y energía |
| 3 Puerto | 9 | Corazón de dos mareas | Corazón, agua y pozo |
| 3 Puerto | 10 | Hielo y fuego | Hielo, fricción y explosión |
| 3 Puerto | 11 | Marea encadenada | Combo y dos reactores |
| 3 Puerto | 12 | El kraken de marea | Jefe: nivel del agua sube por golpe |
| 4 Fábrica | 1 | Viento de la fábrica | Viento y deriva por masa |
| 4 Fábrica | 2 | Canal de enfriamiento | Flotabilidad y arrastre |
| 4 Fábrica | 3 | Elevador rítmico | Plataforma oscilante |
| 4 Fábrica | 4 | Polea de fundición | Polea de Atwood |
| 4 Fábrica | 5 | Pozo de la caldera | Pozo y zona gravitatoria |
| 4 Fábrica | 6 | Demolición de acero | Demolición y momento |
| 4 Fábrica | 7 | Cadena de engranajes | Dominós, reactor e imán |
| 4 Fábrica | 8 | Péndulo de vapor | Péndulo y energía |
| 4 Fábrica | 9 | Corazón de dos campos | Corazón, imán y pozo |
| 4 Fábrica | 10 | Circuito electromagnético | Electroimán y lógica AND/OR |
| 4 Fábrica | 11 | Gran circuito | Combo y dos reactores |
| 4 Fábrica | 12 | El autómata | Jefe: plataforma acelera por golpe |
| 5 Estación | 1 | Viento orbital | Viento y deriva por masa |
| 5 Estación | 2 | Laguna de vacío | Flotabilidad y arrastre |
| 5 Estación | 3 | Plataforma orbital | Plataforma oscilante |
| 5 Estación | 4 | Atwood estelar | Polea de Atwood |
| 5 Estación | 5 | Pozo de marea | Pozo y zona gravitatoria |
| 5 Estación | 6 | Impacto de asteroide | Demolición y momento |
| 5 Estación | 7 | Cadena orbital | Dominós, reactor e imán |
| 5 Estación | 8 | Péndulo de la estación | Péndulo y energía |
| 5 Estación | 9 | Corazón de dos campos | Corazón, pozo y zona gravitatoria |
| 5 Estación | 10 | Resonancia y fatiga | Resonancia y rotura progresiva |
| 5 Estación | 11 | Gran integración | Combo y dos reactores |
| 5 Estación | 12 | El horizonte | Jefe: órbita acelera por golpe |

El informe automático registra soluciones de referencia reproducibles; la búsqueda voraz no prueba
un mínimo global y no sustituye el playtesting humano.

### 5.6 Pares finales de Aventura (2026-10-25)

Los tiros por slot son `3,3,3,3,3,4,4,4,4,4,6,6` en todos los mundos.
Los pares finales, en orden de nivel 1 a 12, son:

| Mundo | Pares por nivel |
|---|---|
| 1 Pradera | 1, 1, 2, 1, 1, 2, 2, 2, 2, 2, 4, 4 |
| 2 Cañón | 1, 1, 2, 1, 2, 2, 2, 2, 2, 2, 4, 4 |
| 3 Puerto | 1, 2, 2, 1, 1, 2, 2, 2, 2, 2, 4, 4 |
| 4 Fábrica | 1, 1, 2, 1, 1, 2, 2, 2, 2, 2, 4, 4 |
| 5 Estación | 1, 1, 2, 1, 2, 2, 2, 2, 2, 2, 4, 4 |

Se toma `minShots` hallado por la búsqueda y se limita al intervalo `[shots − 2, shots − 1]`;
así el nivel 11 y los jefes conservan pares 4 aunque una búsqueda de un tiro encuentre rutas
rápidas.

### 5.7 Soluciones de referencia (malla determinista)

Secuencias ganadoras guardadas por `tools/sim.js --all`. Los porcentajes están redondeados para
legibilidad; para repetir con precisión, usar los valores completos de `docs/validacion.md`.

| ID | Secuencia (ángulo / potencia / proyectil) |
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

### 5.8 Parámetros de Hardcore e Infinito (2026-10-25)

| Parámetro | Valor | Uso |
|---|---:|---|
| Umbral de estrellas Hardcore | 3 por nivel | Si no se alcanza, la run termina |
| Bonus de nivel Hardcore | 100 puntos | Se suma tras superar cada nivel |
| Bonus de jefe Hardcore | 200 puntos | Extra por jefe; los golpes al jefe también duplican `SCORE_BOSS_HIT` |
| Historial Hardcore | 10 runs | Además del récord y el checkpoint de siguiente nivel |
| Preserva tiros Infinito | 3 al empezar, máximo 5 | Los sobrantes del nivel se convierten en reserva |
| Presupuesto procedural | `min(40, 4 + 0.9 × índice)` | Costes de objetivo, mecanismo y campo |
| Intensidad procedural | `min(2.5, 1 + 0.035 × índice)` | Niveles normales; los jefes usan la intensidad base del mundo (`[1, 1.25, 1.5, 1.75, 2]`) |
| Modificadores simultáneos | 1 hasta nivel 5; hasta 2 al 15; hasta 3 después | Campos compatibles según presupuesto |
| Malla del navegador | 24 ángulos × 4 potencias | Niveles normales; los jefes añaden secuencias con ángulo, potencia y munición variables |
| Reintentos de generación | 12 normales; 1 en jefes | Los intentos de un jefe son idénticos, así que no se repiten |
| Corazones en Hardcore | +1 tiro | Solo dentro del nivel actual; no pasan al siguiente |
| Lote de aceptación | 5 semillas × 50 niveles | 250/250 válidos, 0 fallos, 0 respaldos, 155,7 s |
| Mutadores | Uno por bloque de 5 niveles | Deterministas para la misma semilla |
| Semilla diaria | FNV-1a sobre fecha local `AAAA-MM-DD` | Mismo día local produce semilla reproducible |

## 6. Problemas encontrados y soluciones

| Síntoma | Causa | Solución | Archivo |
|---|---|---|---|
| La trayectoria prevista no coincidía con el vuelo real | La predicción usaba otra fórmula distinta a la integración de matter.js | Se usa la misma integración: `vx *= 1 - frictionAir`, `vy = vy * (1 - frictionAir) + gStep` | `js/game.js` (`drawAimAssist`) |
| El proyectil atravesaba una cuerda sin cortarla | A 20 px/paso, comprobar solo el punto actual podía saltarse el segmento | Segmento barrido de posición anterior a actual + `ROPE_CUT_PAD` y velocidad mínima | `js/game.js` (`checkRopeCuts`), `js/config.js` |
| La estructura se autodestruía al asentarse | Los contactos de reposo aplicaban daño durante la carga | `MIN_IMPACT_SPEED = 3.0` y ventana de gracia `GRACE = 0.6` | `js/game.js`, `js/config.js` |
| Errores al eliminar cuerpos durante una colisión | Se mutaba el mundo mientras matter.js recorría los pares | Cola `doomed` y eliminación diferida en `flushDoomed()` | `js/game.js` |
| El reactor se activaba con el propio proyectil en niveles de cadena | El sensor aceptaba cualquier cuerpo dinámico | `requireChain` y exclusión explícita de `kind === 'bird'` | `js/game.js`, `js/levels.js`, `js/campaign.js` |
| Un corazón recogido con el último tiro no daba el tiro extra | La fase ya estaba en `ending` y el tiempo de derrota seguía corriendo | `collectHeart()` cancela `ending`, pasa a `reloading` y reinicia el temporizador | `js/game.js` |
| Los sensores podían quedar bloqueados durante la ventana de gracia | El `continue` de gracia se ejecutaba antes de las comprobaciones de sensor | Corazones, jefe y reactores se comprueban antes del `continue` de gracia | `js/game.js` (`onCollisionStart`) |
| El guardado podía fallar o perder datos con `localStorage` vacío, corrupto o bloqueado | `JSON.parse` y `getItem/setItem` pueden lanzar excepciones | `try/catch`, valores por defecto y saneado con `progressSanitizeLevels`/`progressClampInt` | `js/progress.js` |
| El canvas se deformaba en pantallas que no eran 16:9 | p5 fija `width`/`height` en línea al crear el canvas | CSS con `min(100vw, 177.78vh)` y `!important` para mantener la proporción | `css/style.css` |
| El audio no sonaba hasta interactuar | Los navegadores suspenden `AudioContext` sin gesto del usuario | `Sfx.ensure()` en `pointerDown` y `resume()` si está suspendido | `js/audio.js`, `js/game.js` |
| La palanca no lanzaba el bloque: este resbalaba | La inercia de la palanca era demasiado alta para el peso que caía | Densidad de palanca `0.0007` y del bloque `0.0012` | `js/levels.js`, `js/campaign.js` |
| La cadena de dominós se bloqueaba o no llegaba | Separación/altura mal ajustadas | 6 fichas de 44 px de alto separadas 45 px en el nivel 6; 8 fichas en 1-8 | `js/levels.js`, `js/campaign.js` |
| Las coordenadas táctiles no coincidían al escalar el canvas | Se usaban coordenadas de cliente sin convertir | `getBoundingClientRect()` y escala a 1280 × 720 | `js/sketch.js` |
| La predicción con viento se separaba del vuelo real | La línea seguía siendo una parábola sin campos | Proyectil virtual + `Fields.apply` en cada paso, parada en choque/agua/150 pasos | `js/game.js`, `js/fields.js` |
| El agua no reproducía la flotación esperada | Densidad y arrastre elegidos a ojo | Calibración con matter.js: densidad `0.0040`, arrastre `0.085`; vidrio 40 %, madera 60 %, piedra se hunde | `js/config.js`, `js/fields.js` |
| Cargar un nivel de prueba desde consola dejaba el menú | `loadLevel` no cambiaba de pantalla sin `meta.screen` | Campo opcional `meta.screen = 'play'` y helper `game.startTestLevel()` | `js/game.js` |
| El tamaño de texto de p5 no se reaplicaba de forma fiable | `textSize()` no siempre conserva la familia | Helper `useText(size, bold)` que fija familia + tamaño | `js/config.js` |
| Los eventos de los campos avanzados no hacían sonido ni activaban reactores | `fieldState.events` no existía; los módulos escribían en su copia y `takeEvents` leía la raíz | `Fields.create` comparte el array raíz y `takeEvents` lo vacía en el sitio | `js/fields.js` |
| La polea de Atwood daba velocidades enormes y las masas subían | Los `Matter.Constraint` con holgura empujan las masas lejos del ancla | Se eliminan los constraints; la cuerda se modela con tensión de Atwood + `vL+vR=0` y suma de desplazamientos | `js/fields-advanced.js` |
| El reactor láser seguía encendido tras girar el espejo | `targetLit` solo pasaba a `true`, nunca a `false` | Se reinicia a `false` cada paso y se vuelve a calcular desde cero | `js/fields-advanced.js` |
| La carga de una plataforma móvil se hundía hasta 11 px | El choque con el objetivo desplazaba la pieza después de `Engine.update` | `Fields.afterUpdate` reafirma la posición de las cargas al final del paso | `js/fields.js`, `js/fields-advanced.js`, `js/game.js` |
| La predicción podía duplicar plataformas, poleas, espejos o hielo | `Fields.create` se llamaba sin el contexto de predicción | `init` solo crea cuerpos si `state.game` existe y `state.predict` es falso | `js/fields-advanced.js` |
| Todos los jefes de Infinito caían a la plantilla de respaldo | La validación repetía el mismo ángulo y la misma munición tras cada teletransporte | `generatorSolveBoss()` busca secuencias con ángulo, potencia y munición distintos y presupuesto acotado | `js/generator.js` |
| Los jefes del mundo 3 eran imposibles a profundidad 40 | La intensidad de profundidad (2,4×) escalaba el agua de una arena calibrada para 1,5× | Los jefes conservan la intensidad base de su mundo y solo los niveles normales escalan con la profundidad | `js/generator.js` |
| Generar un jefe fallido tardaba más de 10 s | Se repetían doce intentos idénticos y cada uno recorría la malla completa | Los jefes se validan una sola vez; si fallan, pasan al respaldo | `js/generator.js` |
| La munición limitada podía dejar al jugador sin el cohete | El mutador descartaba el último proyectil de la lista | Se descarta el primero (normalmente el básico) y se conservan las herramientas avanzadas | `js/generator.js` |

### Ajustes de campaña para eliminar resultados rojos (2026-10-25)

- **2-5 Vórtice del desierto.** El pozo se dejó en `k: 0.5`, radio `60`; la zona final usa
  `g: 0.05`. El campo ahora curva la trayectoria sin cerrar el acceso; quedó resoluble en 2 tiros.
- **2-9 Oasis de dos corrientes.** Se redujeron los campos a viento `fx: 0.25`, `gust: 0.08`,
  periodo `200`, y pozo `k: 1.5`, radio `40`. Se evitó que el entorno consumiera objetivos durante
  la gracia; el nivel quedó resoluble en 1 tiro y sin autodestrucción.
- **Niveles acuáticos y de corazón.** Se estabilizaron soportes y se acercaron objetivos para que
  los campos no desplacen las estructuras antes del primer disparo.
- **3-10, 3-11 y 5-10.** Se conectó el disparador térmico al dato del nivel, se integraron fichas
  de dominó en la cadena de reactores y se asoció la estructura resonante a un objetivo derribable.
- **3-12 y 5-11.** Se despejó la arena del jefe de marea y se ajustó la geometría de integración
  para que la búsqueda encuentre rutas sin alterar la regla común de tres golpes.
- **Todos los pares de Aventura.** Se guardan como datos por mundo/nivel, usando
  `clamp(minShots, shots − 2, shots − 1)`; el Clásico no se modifica.

## 7. Pendientes

> El README solo menciona explícitamente la **fase 3** como cerrada. Las fases 1A, 1B y 1C se
> deducen del estado del código y de la estructura del proyecto; no hay registro previo. Las fases
> 4 y 5 están implementadas, probadas y con el lote de aceptación de Infinito completado; queda el
> playtesting humano y una run manual completa de Hardcore.

### Fases

- [x] **1A — Base física y Clásico.** Motor matter.js, paso fijo, resortera, materiales, daño,
  puntuación, 6 niveles clásicos, render p5, audio y servidor local.
- [x] **1B — Menú y pantallas.** Menú principal, selección de mundo/nivel, modo Clásico, navegación
  con ratón/táctil/teclado y pausa con `Esc`.
- [x] **1C — Progreso, estrellas y mecanismos.** Guardado v2, récords, estrellas, cuerdas,
  palancas, dominós y reactores en los niveles 4–6.
- [x] **2 — Primera Aventura Mundo 1.** Primera versión con niveles 1-7 a 1-11 y reutilización
  de los clásicos como 1-1 a 1-6; la campaña posterior la sustituyó por 12 niveles propios de
  Aventura sin cambiar `levels.js` ni el modo Clásico.
- [x] **3 — Corazones, jefe y cierre del Mundo 1.** 1-9, 1-11, 1-12, jefe con teletransporte y
  obstáculos, HUD de jefe, corazones y panel final.
- [x] **3.5 — Campos: viento y agua.** `js/fields.js`, viento con ráfagas deterministas, agua con
  flotación exacta, predicción compartida, overlay `V`, chapoteo, niveles ocultos de prueba y
  documentación. Los 6 clásicos siguen sin `fields` y conservan su física.
- [x] **3.6 — Campos avanzados.** `js/fields-advanced.js` con pozos, zonas de gravedad,
  plataformas móviles, poleas de Atwood, imanes, láser/espejos y térmica; niveles ocultos,
  predicción compartida y documentación en README 4.11. Los clásicos siguen intactos.
- [x] **4.12 — Proyectiles especiales.** Seis tipos, selector HUD/teclado, predicción, overlay `V`,
  sonidos, nivel oculto y documentación en README 4.12. Clásico y guardado sin cambios.
- [x] **Temas, intensidad y plantillas (pre-Fase 3).** Cinco ambientes, sonido ambiente, `scaleFields`,
  `WORLDS`, `STRUCTURES`, `TEMPLATES`, selector 4×3 y `?unlock=all`; niveles nuevos siguen vacíos.
- [x] **4 — Hardcore (flujo implementado y verificado).** Run de 60 niveles, una vida, 3 estrellas
  mínimas, sin reinicio y guardado de mejor run, historial y checkpoint. Los corazones añaden un
  tiro solo dentro de su nivel. La victoria de los 60 niveles se comprobó con una run forzada;
  falta una partida manual completa.
- [x] **5 — Infinito (implementación y aceptación).** Semillas, generador determinista, validación
  headless, mutadores, jefes, recapitulación de derrota y ranking local. El lote de 5 semillas × 50
  niveles dio 250/250 válidos, 0 fallos y 0 respaldos en 155,7 s. Falta playtesting humano de
  variedad y dificultad.
- [x] **6 — Validación automática de la campaña.** Simulador determinista, 60 soluciones de
  referencia, pares ajustados e informe con malla, trivialidad y autodestrucción. Pendiente aparte:
  playtesting humano y comprobación de estrellas/desbloqueo en una partida completa.
- [ ] **FINAL — Pulido y cierre.** Balance final, migración de récords, pruebas en más navegadores,
  documentación definitiva y revisión de rendimiento.

### Deuda técnica

- [ ] **`Math.random()` en presentación/audio.** Las semillas de cuerpos/corazones y las partículas
  de impacto/confeti de campaña ahora derivan del nivel/paso; queda `Math.random()` en la sacudida
  de pantalla y en `Sfx`. Esos usos no afectan las fuerzas físicas.
- [ ] **Temporizadores con `dt` real.** `graceTimer`, `reloadTimer`, `endTimer`, `banner` y
  `flightTime` avanzan con el `dt` del render (limitado a 0.05), no con el contador de pasos. La
  física es determinista, pero una repetición estricta de una partida requeriría contarlos en
  pasos fijos.
- [ ] **`Sfx` usa `performance.now()` y `Math.random()`** para limitar la frecuencia de impactos y
  variar tonos. Es audio, no simulación; documentarlo o moverlo a un RNG de presentación.
- [ ] **Migración desde `BEST_KEY`.** `CONFIG.BEST_KEY` existe por compatibilidad, pero
  `Progress` no importa los récords antiguos de `resortera_vs_torre_best` a la estructura v2.
- [x] **Campaña validada automáticamente.** `tools/sim.js --all` ejecuta los 60 niveles y genera
  las soluciones de referencia en `docs/validacion.md`. La búsqueda voraz no demuestra un mínimo
  global y no reemplaza el playtesting.
- [x] **Flujos de Hardcore e Infinito.** Código, tests y lote de aceptación completados; el
  playtesting humano sigue recogido en la entrada de 2026-10-25 de la sección 3.
- [x] **Aceptación de Infinito.** 250/250 niveles generados, validados y resueltos en 155,7 s, sin
  fallos ni respaldos; el peor nivel tardó 4,5 s.
- [x] **Determinismo del simulador.** `node tools/tests.js` verifica las definiciones de campaña y
  que repetir el mismo disparo produzca el mismo resultado.
- [ ] **`05-victoria.png` no se usa** en el README actual; decidir si se referencia o se elimina.
- [x] **Pares de campaña.** Los 60 `par` se limitan con los tiros mínimos encontrados y quedan
  documentados en la sección 5; las estrellas aún requieren una pasada completa en navegador.
- [x] **Intensidad por mundo.** `INTENSITY` y `Fields.scaleFields()` escalan campos de campaña,
  incluidas las zonas gravitatorias y resonancia.
- [ ] **Jefes de campaña en navegador.** La búsqueda resuelve los cuatro jefes con sus sensores y
  efectos de golpe; falta confirmar las tres transiciones de cada uno en juego manual.
- [ ] **Rendimiento del agua.** La geometría sumergida se recalcula por cuerpo y paso; falta medir
  con muchas piezas simultáneas y, si hace falta, cachear el recorte o limitar la frecuencia.
- [ ] **Campos en la puntuación/estrellas.** El viento y el agua no añaden bonus ni cambian el par;
  decidir si los niveles futuros necesitan objetivos o recompensas específicas.
- [x] **Campos avanzados en Aventura.** La búsqueda valida soluciones para los niveles con pozos,
  zonas, plataformas, poleas, imanes, láser y térmica; el balance humano sigue pendiente.
- [ ] **Carga de plataforma reafirmada cada paso.** `Fields.afterUpdate` fija la pieza al carril
  después del motor; si en el futuro una carga debe poder caer por un impacto, habrá que definir
  una condición de desprendimiento explícita (hoy el umbral de 70 px es inalcanzable).

## 8. Cómo retomar

1. **Leer primero:** `README.md` y este `contexto.md` (secciones 1, 3, 5, 7 y 8); después
   `js/config.js`, `js/rng.js`, `js/progress.js`, `js/core.js`, `js/generator.js`, `js/campaign.js`
   y `js/game.js`.
2. **Ejecutar:** `node serve.js` y abrir `http://localhost:8123`, o hacer doble clic en
   `index.html` (las librerías están en `lib/`).
3. **Probar:** menú → **Modo Clásico** → nivel 1 (arrastrar y soltar); menú → **Aventura** →
  seleccionar cualquiera de los 5 mundos (usa `?unlock=all` para humo), revisar la consola, `V`
  para física, `R` para reiniciar y `Esc` para volver.
  Munición: `game.startTestLevel('ammo')`; campos: `game.startTestLevel('wind')`, `game.startTestLevel('water')`,
   `game.startTestLevel('pulleys')` (con `game.measureAtwood()`) y el resto de nombres de
   `TEST_LEVELS` desde la consola. `game.startTestLevel('combined')` sirve para rendimiento.
4. **Pruebas ambientales:** `game.startThemeTest(1)` a `game.startThemeTest(5)`; para navegar los
  slots sin desbloquear, abre la página con `?unlock=all` (temporal, no guarda progreso).
5. **Fase siguiente:** playtesting humano de estrellas, desbloqueos, mutadores y jefes; completar
   una run manual de Hardcore de los 60 niveles; comprobar semillas/compartir/ranking en navegador
   y revisar el rendimiento del agua en niveles con muchas piezas.
6. **Regla de oro:** mantener el paso fijo, el RNG con semilla, los niveles como datos y el Clásico
   intacto; al terminar, añadir la entrada a la sección 3 y actualizar las secciones 5 y 7.
