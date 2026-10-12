# Reloj y arranque de escenarios

## Contrato

La autopausa es un objetivo absoluto de tiempo simulado. Se ejecuta en el primer
instante de la rejilla de pasos que alcanza o supera el objetivo: con dt=4 ms,
12001, 12002 y 12003 se resuelven a 12004 ms. La desviación es menor que un paso;
no se integra un paso parcial ni se alteran las ecuaciones. Un objetivo ya
alcanzado pausa inmediatamente. Es de un solo uso: reanudar permite avanzar.

El calentamiento sigue siendo tres ciclos, acotados a 12–20 s, pero respeta la
autopausa y ejecuta las perturbaciones desde t=0. Las perturbaciones se aplican
en el primer punto de la rejilla que alcanza su fecha, incluso cuando coincide
con el final del lote o calentamiento, antes de publicar el cuadro. Así SC-12
registra `setSensors` a 10000 ms y su sensor evoluciona durante los 2000 ms
restantes del calentamiento.

El arranque por URL crea un solo mundo y conserva `paused=1` para todos los
escenarios. El escenario opcional en `init` aporta la programación de eventos;
los parámetros iniciales siguen procediendo del `SimulatorInit` del llamador.
Cambiar de escenario mantiene el comportamiento explícito de iniciar su marcha,
pero descarta la autopausa anterior. Importar una sesión también la descarta.

## Evidencia sintética

Antes: tres regresiones de anfitrión fallan: 12001 deja el reloj en 12000 con
`running=true`, SC-12 registra el sesgo a 12000 y otro escenario hereda el límite.
Tres pruebas de navegador también fallan: SC-02 y SC-12 muestran Pausar pese a
`paused=1`, y la autopausa no termina.

Después: 12 casos de reloj, incluidos 0/1/12000/12001/12003/12004, reanudación,
arranque pausado, marca de evento y equivalencia del estado persistente entre
calentamiento y avance normal. Con las regresiones de medición y revisión,
47/47 focalizados. Chromium local confirma Reanudar, pausa visible y tiempo
12004; la sesión exportada de SC-12 contiene exactamente un `setSensors` a 10000.
Las capturas SC-12 y autopausa fueron inspeccionadas visualmente.

Los logs y capturas están en `../evidence/clock-*`, fuera del árbol versionado.
La batería final acumulada y los SHA se registran en la entrega de esta tarea.
No se cambian dt, ecuaciones, frecuencia del temporizador ni presupuesto por
lote. Las pruebas demuestran coherencia de software con datos sintéticos;
no constituyen validación clínica externa.

## Cierre de comprobaciones

Tras las correcciones: `check` 573/573 (74 archivos), cobertura líneas 69.67%,
ramas 60.83%, funciones 67.33%, sentencias 67.54%, sin modificar umbrales.
Build correcto. E2E acumulados: 381 pasan, 27 omitidos por las condiciones
existentes de viewport, cero fallos (136 casos en tres proyectos; 3.1 min).
Resultados y hechos documentales regenerados desde JSON reales y comprobados.
La desconexión notificada por el padre no interrumpió ningún comando observado;
no se repitió ninguna acción incierta. Todo permanece local, sin publicación.
