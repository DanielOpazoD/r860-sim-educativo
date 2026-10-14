# Auditoría visual frente a las pantallas del equipo (13-10-2026)

**Qué se comparó.** La pantalla del simulador, capturada a 1280×860 en SC-13 (A/C PC, vista de curvas) y SC-22 (A/C VC con fuga), frente a dos referencias del CARESCAPE R860:

- **Las pantallas del manual de referencia** (URM SW10 2065490-001 Rev F, R21). Son capturas de 1024×768 incrustadas en el PDF: vistas Basic, Basic Waveform y Advanced Waveform (3-12 y 3-13). No se copian aquí porque son imágenes de GE.
- **Las transcripciones de las fotografías P1 y P3** que ya están en el repositorio (fixtures visuales, `docs/capturas/vis-01-p1-fixture-desktop-1440.png` y `vis-02-p3-fixture-desktop-1440.png`).

Las fotografías originales (IMG_0278, IMG_0284 e IMG_0297) no estaban en este equipo durante la auditoría. Lo que depende de ellas queda pendiente (al final).

Capturas propias: `docs/capturas/aud-01-pc-sc13-curvas.png` y `docs/capturas/aud-02-fuga-sc22-volumen.png`.

## Lo que coincide

| Elemento | Equipo (manual y P1/P3) | Simulador |
| --- | --- | --- |
| Fila superior | Menú, tipo de paciente, banda de alarmas con «Config. de alarmas», teclas favoritas configurables | Igual; favoritas ↑O₂, Bloqueo insp, Bloqueo esp, Resp manual |
| Vista de curvas | Pva, flujo y volumen apilados a la izquierda, con su unidad arriba a la derecha | Igual |
| Valores medidos | Dos columnas: rótulo arriba, número grande y unidad debajo | Igual |
| Barra de presión | Escala 0–60, línea de Pmáx en rojo, Ppico y PEEP rotuladas, VTesp y FiO₂ al pie | Igual; el pie sigue a P1 (VTesp grande, FiO₂ abajo) |
| Vista básica | Seis casillas grandes (FiO₂, PEEPe, Ppico, VMesp, VT, FR) | Alternador de 6 casillas grandes, como en P3 |
| Fila inferior | Modo actual, ajustes del modo, EN ESPERA y conexión | Igual |
| Curva de volumen con fuga | Datos que recibe el ventilador (9-8): con fuga la rama espiratoria no vuelve a cero | Igual desde el bloque H (`aud-02`): termina en VTi − VTe y se reinicia |

## Diferencias deliberadas, ya documentadas

| Diferencia | Equipo | Simulador | Por qué |
| --- | --- | --- | --- |
| Límites de alarma junto a cada valor | Opcional: la casilla «Alarm Limits» de la configuración de alarmas los muestra u oculta (URM 8-6; las pantallas del manual la tienen activada) | Ocultos; se ajustan en «Config. de alarmas» | Decisión docente (docs/02, «Pantalla única y monitor más limpio»), equivalente a esa casilla desactivada |
| Colores de las curvas | Configurables en el equipo: blanco, verde, rojo, amarillo o azul (URM 23-6) | Los de la transcripción de P1 | El manual no fija un color: no hay discrepancia |
| Rótulos | Inglés en el manual | Español, como en las fotografías P1 y P3 del equipo localizado (E-025) | Observado (O) |

## Resuelto: la banda de alarmas en reposo vuelve al verde

El manual (en las tres vistas) y la transcripción de P1 muestran la banda **verde** con «No Alarms» / «Sin alarmas» cuando no hay alarmas. Desde la ronda v0.5.2 el simulador la mostraba del azul del monitor, por contraste (3,22:1 el título y 2,74:1 el subtítulo sobre el verde claro de entonces). Tras esta auditoría vuelve al verde, con un tono más profundo y texto blanco que cumple el mínimo AA (CTR-01, que ahora también exige que el reposo sea verde). Desde la pasada de paleta (abajo) es el verde amarillento de las capturas, #2b6f1a → #36832a: 6,2:1 y 4,7:1.

## Paleta y acabado del equipo (13-10-2026)

Las capturas del manual son la imagen que genera el propio equipo, sin cámara de por medio, así que sus colores se pueden medir. Se midieron en las vistas Basic, Basic Waveform, Advanced Waveform, Flow-Volume y en la de alarma de VTesp bajo (3-12 a 3-14 y 8-8) y la pantalla se ajustó a ellas (E-118, D). Capturas propias: `docs/capturas/aud-04-paleta-curvas.png`, `aud-05-paleta-alarma.png` y `aud-06-paleta-bucles.png`.

| Elemento | Equipo (medido en las capturas) | Antes | Ahora |
| --- | --- | --- | --- |
| Fondo de la pantalla | Azul pizarra: #15395b en los bordes, #2b3f58 en el área de datos, #455974 hacia el centro | Azul saturado #004eaf → #0053b5 | Degradado radial #3b4f68 → #2c405a → #1b3350 |
| Teclas de arriba y de ajustes | Grafito, #1e222b a #303440, rótulo blanco | Azul con rótulo celeste | Grafito con rótulo blanco; «Modo actual», más oscura |
| Fila de vistas | Banda casi negra (#040c19 a #0d1321), botones redondos grises, el activo con halo cian | Azul | Igual que el equipo |
| Columna numérica | Rótulo y cifra blancos en negrita, unidad gris | Rótulo celeste, cifra de peso medio | Rótulo y cifra blancos en negrita (700), unidad #d6dee8 |
| Curvas | Trazo blanco; relleno de presión amarillo (Basic Waveform) o azul (Advanced), flujo verde, volumen blanco | Trazos celestes, flujo y volumen celestes | Trazo blanco; presión amarilla (como en P1), flujo verde, volumen blanco |
| Bucle flujo-volumen | Relleno verde | Trazo turquesa | Relleno verde y trazo blanco |
| Barra de presión | Panel redondeado algo más claro; tubo negro con relleno verde, marcas cian, Pmáx roja, Ppico y PEEP blancas; VTesp y FiO₂ en dos columnas | Tubo azul con relleno turquesa, Pva numérica arriba | Igual que el equipo, con «Pva» y su unidad arriba |
| Valor en alarma | Borde del color de la prioridad alrededor de la cifra y sus límites (8-7, captura 8-8) | Bloque ámbar sólido con número negro | Borde ámbar (media) o rojo (alta), cifra blanca |
| Banda sin alarmas | Verde amarillento #3c9225 | Verde azulado | Verde amarillento algo más profundo, por contraste |
| Ventanas del equipo (modos, límites, menús) | Grafito: panel gris oscuro, cajas de valor más claras, cabecera y pie más claros (configuración de alarmas, 8-6) | Azul saturado | Grafito (#2c2f36, cajas #3a3e46, cabecera #3d424b) |

Los contrastes se recalcularon sobre el extremo más claro del nuevo fondo (#3b4f68): las cifras pequeñas de la columna numérica superan 6:1, el texto de ejes 6,5:1 y los bordes de alarma 3:1 (CTR-02, CTR-03 y CTR-05). La tipografía sigue siendo Arial: el equipo usa una sans humanista en negrita que no se distribuye con el navegador.

## «Fuga %» vuelve a la columna numérica (13-10-2026)

La foto P1 (E-025, O) y las pantallas del manual (Advanced Waveform y Flow-Volume: «Leak % 5») muestran la fuga como una línea centrada sobre el grupo de VMesp y FR. La interfaz la tuvo hasta v0.1 y se perdió al pasar a la de R860 Lab en v0.2: la medición siguió en la tabla, pero no en el monitor. Vuelve en su sitio, en enteros de la última respiración (`aud-07-fuga.png`). En la vista de seis casillas no aparece, y en móvil va al pie de la rejilla para no dejar una fila a medias.

## Medición de bloqueo sin resultado: X roja (13-10-2026)

El manual (7-7) dice que, si el bloqueo no da Pplat o Cstat, «a red X will display indicating a failure». La ventana de bloqueo mostraba el mismo guion que antes de medir. Ahora una medición terminada sin resultado pone una ✕ roja en su casilla (≥ 3:1 sobre la ventana), con el nombre accesible «Medición no disponible»; el motivo sigue en la línea de estado (E-113).

## La espera, tostada como en el equipo (13-10-2026)

El manual describe la espera así: «the Standby quick key and the patient status (airway pressure) bar are colored tan» (3-6, figura 3-4). El simulador la tapaba entera con un beige verdoso, barra de presión incluida, con un botón verde y la tecla en oliva. Ahora (E-120, `aud-08-espera.png`):

- Un panel tostado (#e7dab8, medido en la figura) cubre sólo el área de datos.
- La barra de presión queda a la vista en su propio panel tostado, con el tubo vacío y sin marcas.
- La tecla EN ESPERA se vuelve tostada con rótulo oscuro.
- El botón de iniciar es naranja.
- Las teclas de procedimiento quedan grises e inactivas.

Los textos oscuros sobre el tostado cumplen 4,5:1.

## Pendiente con las fotografías originales

- Comprobar con P1–P3 los colores de las curvas y del relleno que tenía configurados ese equipo (el manual deja elegirlos) y la tipografía.
- Comprobar el área de mensajes de la izquierda de la fila de vistas. El manual muestra ahí avisos técnicos («Calibration required»); el simulador muestra la fase de la respiración.
- Revisar con P2 el acercamiento del mando y del rótulo CARESCAPE R860.
