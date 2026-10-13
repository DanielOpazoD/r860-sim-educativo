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

El manual (en las tres vistas) y la transcripción de P1 muestran la banda **verde** con «No Alarms» / «Sin alarmas» cuando no hay alarmas. Desde la ronda v0.5.2 el simulador la mostraba del azul del monitor, por contraste (3,22:1 el título y 2,74:1 el subtítulo sobre el verde claro de entonces). Tras esta auditoría vuelve al verde, con un tono más profundo (#116b35 → #178042) y texto blanco que cumple el mínimo AA: 6,6:1 y 5,0:1 en los dos extremos del degradado (CTR-01, que ahora también exige que el reposo sea verde).

## Pendiente con las fotografías originales

- Comprobar con P1–P3 los colores exactos de las curvas y del relleno, y la tipografía.
- Comprobar el área de mensajes de la izquierda de la fila de vistas. El manual muestra ahí avisos técnicos («Calibration required»); el simulador muestra la fase de la respiración.
- Revisar con P2 el acercamiento del mando y del rótulo CARESCAPE R860.
