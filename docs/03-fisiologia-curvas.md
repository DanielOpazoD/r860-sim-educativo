# Fisiología de las curvas: qué debe verse y por qué

Documento de referencia para clínicos e ingenieros que usan o auditan el simulador. Explica qué forma deben tener las curvas de presión, flujo y volumen en A/C VC, A/C PC y CPAP/PS según la mecánica que el motor implementa, y enlaza cada afirmación con la prueba automática que la comprueba. Es física de un modelo, no de un paciente: el simulador no contiene datos de pacientes reales.

Convención de marcas (la misma de `02-diferencias-frente-al-dossier.md`): **D** documentado por una fuente (manual, ficha o bibliografía citada), **O** observado en las fotografías P1/P3, **P** plausible o supuesto por diseño del simulador, **U** desconocido.

Unidades en todo el documento: presión en cmH₂O, volumen en L (la interfaz muestra mL), flujo en L/s (la interfaz muestra L/min), resistencia en cmH₂O·s/L, distensibilidad en L/cmH₂O (la interfaz muestra mL/cmH₂O), tiempo en s.

## 1. Ecuación de movimiento y modelo

El motor (`src/engine/patient.ts`) parte del modelo lineal de un compartimento, que sigue siendo el comportamiento por omisión. Sobre él se añaden, sólo si el paciente los declara, la relajación viscoelástica, la curva sigmoidea, la resistencia de Rohrer, la limitación al flujo, el calibre dependiente del volumen y una segunda unidad alveolar en paralelo (§8):

    Pva + Pmus = P0 + V/C + R(Q)·Q        Q = dV/dt        R(Q) = R1 + R2·|Q|

- **Pva** es la presión de vía aérea que impone o mide el ventilador; **Pmus** el esfuerzo muscular (positivo cuando favorece la entrada de gas); **P0** la presión de relajación (0 en todos los escenarios); **V** el volumen absoluto sobre el volumen de relajación (no se reinicia al cambiar PEEP ni al empezar una maniobra); **C** la distensibilidad del sistema respiratorio; **R1** la resistencia lineal, distinta en inspiración (`rInsp`) y espiración (`rExp`) según el signo del flujo; **R2** un término cuadrático opcional (0 en todos los escenarios, ver §8).
- La forma bibliográfica equivalente es Pvent + Pmus = E·V + R·Q con E = 1/C (D: Mireles-Cabodevila y Chatburn 2025; Chatburn 2026).
- Dos formas de operar el mismo modelo: **fuente de flujo** (el ventilador impone Q y la presión resulta: `pawForFlow`) y **fuente de presión** (el ventilador impone Pva y el flujo resulta: `flowForPaw`, integrado con RK2/Heun y sub-pasos de 0,2·τ). VC usa la primera durante la inspiración; PC, la espiración y las fases limitadas por presión usan la segunda.

**Constante de tiempo.** Con presión constante, volumen y flujo siguen exponenciales con τ = R·C. La fracción del cambio total completada tras n constantes de tiempo es 1 − e^(−n):

| Tiempo | 1 τ | 2 τ | 3 τ | 4 τ | 5 τ |
| --- | --- | --- | --- | --- | --- |
| Completado | 63,2 % | 86,5 % | 95,0 % | 98,2 % | 99,3 % |

Se acepta que 3–5 τ bastan para una inspiración o espiración «completa» (D: Mireles-Cabodevila y Chatburn 2025 cita ~3 τ ≈ 95 % de la espiración; Chatburn 2026). En el banco de referencia (C 0,05 L/cmH₂O, R 10) τ = 0,5 s; el panel docente muestra τ espiratoria = Rexp·C.

El panel docente añade, bajo la mini-curva de Pmus, un bucle **presión · volumen del pulmón** que el monitor no ofrece: dibuja el bucle Pva·V del ciclo y, superpuesta en violeta, la presión total (Pva+Pmus)·V — la presión que realmente distiende pulmón y vía aérea (Paw + Pmus = Pel + R·Q). El área entre ambos bucles es el trabajo que aporta el paciente; con Pmus ≈ 0 sólo queda el bucle de Pva, idéntico al que vería el equipo.

**Energía y potencia mecánica.** En cada inspiración el ventilador entrega al sistema respiratorio la energía ∫ Pva·dV (el área bajo la curva presión-volumen, con 1 cmH₂O·L = 0,098 J); la potencia mecánica es esa energía por la frecuencia (D: Gattinoni et al. 2016). El motor integra el área en cada sub-paso (`energyInspJ` en el registro de la respiración) y publica `mechPower` sobre la misma ventana que FR y VMesp. Para el pulmón lineal pasivo con flujo constante tiene solución cerrada, E = PEEP·VT + R·Q·VT + VT²/(2C), que es exactamente la fórmula de Gattinoni 0,098·FR·VT·[Ppico − ½(Pplat − PEEP)]: en el banco de referencia, 2,5 + 2,5 + 2,5 = 7,5 cmH₂O·L por respiración, 11,0 J/min. En PC con presión constante es (PEEP + Pinsp)·VT. En soporte de presión sólo cuenta lo que pone el ventilador: el trabajo del paciente (Pmus) no entra en Pva.

**Banco de referencia** (SC-01, `tests/helpers.ts`): C 50 mL/cmH₂O, Rinsp = Rexp = 10, PEEP 5, VT 500 mL, FR 15, I:E 1:3 → ciclo 4 s, Tinsp 1 s, Tesp 3 s, flujo 0,5 L/s (30 L/min), sin pausa, sin esfuerzo. Todos los números de este documento salen de ahí salvo indicación.

## 2. A/C VC: fuente de flujo constante

En VC el controlador (`inspFlow`) impone un flujo cuadrado Q = VT/Tflow, donde Tflow = Tinsp·(1 − pausa) (`deriveVcTiming`, P: familia «I:E, control de flujo apagado», D ficha 2014). Presión y volumen son las variables dependientes.

### 2.1 Forma esperada de cada curva (paciente pasivo)

| Curva | Inspiración (flujo) | Pausa (si está programada) | Espiración |
| --- | --- | --- | --- |
| **Pva** | Escalón inicial de R·Q sobre PEEP (5 cmH₂O en el banco) seguido de una rampa lineal de pendiente Q/C hasta Ppico | Cae de golpe en R·Q y queda plana en Pplat = PEEP + VT/C (el motor sólo publica Pplat de ciclo con pausa ≥ 0,1 s y meseta estable ≤ 0,5 cmH₂O; sin pausa muestra `---`, P) | Pva = PEEP (fuente de presión) |
| **Flujo** | Cuadrado constante (+0,5 L/s) | Cero | Negativo, decaimiento exponencial Q(t) = −(V_exceso/τ_exp)·e^(−t/τ_exp), con τ_exp = Rexp·C; vuelve a cero antes del siguiente ciclo si Tesp ≥ 3–4 τ_exp |
| **Volumen** | Rampa lineal hasta VT | Plana | Exponencial hacia el volumen de equilibrio C·(PEEP − P0) |

Relaciones analíticas comprobadas en el banco:

- Ppico = PEEP + R·Q + VT/C = 5 + 10·0,5 + 0,5/0,05 = **20 cmH₂O**.
- Pplat (bloqueo inspiratorio) = PEEP + VT/C = **15 cmH₂O**; la diferencia Ppico − Pplat = R·Q = 5 aísla la carga resistiva, y Pplat − PEEP = VT/C aísla la elástica (D: Mellema 2013, Mireles-Cabodevila y Chatburn 2025).
- Cstat = VT/(Pplat − PEEPe) = 0,5/10 = **50 mL/cmH₂O**; R = (Ppico − Pplat)/Q = 5/0,5 = **10**.
- Espiración: Tesp 3 s = 6 τ_exp, por lo que el flujo espiratorio llega prácticamente a cero (residuo e⁻⁶ ≈ 0,25 %) y VTe = 500 mL.

Descripción cualitativa D (Mellema 2013): con flujo constante la presión tiene un escalón seguido de una subida casi lineal; el bloqueo inspiratorio produce la caída de PIP a Pplat y una meseta en la curva de volumen.

### 2.2 Efecto de cada parámetro en VC (paciente pasivo)

| Cambio | Pva | Flujo | Volumen | Por qué |
| --- | --- | --- | --- | --- |
| ↑ VT | ↑ Ppico y ↑ Pplat en ΔVT/C; con Tinsp fijo también ↑ R·Q | ↑ meseta del flujo (Q = VT/Tflow) | ↑ amplitud | Más volumen elástico y más flujo para entregarlo en el mismo tiempo |
| ↑ FR (I:E fijo) | Sin cambio de Ppico si Tinsp cambia poco; si Tesp < 3 τ_exp aparece PEEPi y ↑ Pplat | ↑ Q (Tinsp más corto); flujo espiratorio no llega a cero | Vaciamiento incompleto: la base de V sube | Tinsp = Tciclo·I:E/(1+I:E) se acorta; Tesp también |
| ↑ I:E hacia 1:1 (FR fija) | ↓ R·Q (Q menor), Pplat igual | ↓ meseta de flujo; Tesp más corto → riesgo de atrapamiento | Igual VT | Más Tinsp para el mismo VT |
| ↑ pausa % | ↑ Ppico (Q sube porque Tflow = Tinsp·(1 − pausa)), Pplat visible y sin cambio | ↑ Q y tramo de flujo cero | Igual VT, meseta más larga | El VT se entrega en menos tiempo |
| ↑ PEEP | Toda la curva se desplaza: Ppico y Pplat suben en ΔPEEP; V absoluto sube a C·ΔPEEP en unas 3–4 τ | Sin cambio en inspiración; transitorio de entrada hasta el nuevo equilibrio | Base absoluta más alta; VTe transitoriamente < VT | El volumen se conserva en el instante del cambio (no se suma PEEP dos veces) |
| ↓ C | ↑ Ppico y ↑ Pplat en la misma cantidad (VT/C); rampa más empinada | Sin cambio | Sin cambio | Sólo cambia la carga elástica; Ppico − Pplat se conserva |
| ↑ Rinsp | ↑ Ppico en Q·ΔR; Pplat sin cambio | Sin cambio mientras no se alcance Plimit | Sin cambio | Sólo cambia la carga resistiva |
| ↑ Rexp | Sin cambio directo; si τ_exp = Rexp·C supera Tesp/3 aparece PEEPi y ↑ Pplat | Flujo espiratorio más lento, pico menor, no vuelve a cero | Vaciamiento incompleto | La espiración es pasiva y la gobierna τ_exp |
| Esfuerzo (Pmus > 0) | Concavidad hacia abajo en la rampa de presión (Pva = Pel + R·Q − Pmus); en pausa o bloqueo la meseta es inestable y se invalida | Sin cambio (el ventilador impone Q); durante la espiración, un esfuerzo que genere flujo ≥ trigger dispara una respiración asistida (tras 0,25 s refractarios, P) | Sin cambio en VC | En fuente de flujo el esfuerzo se resta de la presión, no se suma al volumen |

### 2.3 Plimit y Pmáx: dos respuestas distintas

- **Plimit** (D JB72469XX; guía JB79437XX): al alcanzarlo, el controlador pasa a `inspLimited`, una fuente de presión a Plimit con válvula de un solo sentido (Q ≥ 0). El flujo deja de ser constante y decae exponencialmente con τ = Rinsp·C; la inspiración dura el Tinsp programado (ciclado por tiempo) y **el VT entregado es menor que el programado**. Ppico = Plimit. En la curva: presión truncada en una meseta, flujo que cae, volumen que se aplana antes de VT.
- **Pmáx** (D dossier [04]; JB79437XX): al alcanzarlo, la inspiración **termina de inmediato** (`onPmax`), se registra la causa `pmax`, se activa la alarma de prioridad alta y Pplat de ciclo se declara no válida con motivo `endedByPmax`. El tiempo no usado se añade a la espiración para que la FR programada se respete (P, U-26). En la curva: inspiración corta, VT parcial, espiración inmediata.
- En el instante del cruce la presión registrada es exactamente el umbral, no la presión hipotética del flujo completo (decisión 7 de `02-diferencias`).

## 3. A/C PC: fuente de presión

En PC el controlador (`inspPressure`) impone Pva objetivo = PEEP + Pinsp con una rampa de primer orden hasta ≈95 % en `riseMs` (D JB72469XX para el objetivo; forma exponencial de la rampa P, τ = riseMs/3; ficha 2014 D para la existencia de la rampa). Flujo y volumen son las variables dependientes (D: Messina y Olarewaju 2023; Mireles-Cabodevila y Chatburn 2025).

### 3.1 Forma esperada (paciente pasivo, rampa 0)

    Q(t) = (ΔP/R)·e^(−t/τ)        V(t) = C·ΔP·(1 − e^(−t/τ))        ΔP = Pinsp, τ = Rinsp·C

| Curva | Inspiración | Espiración |
| --- | --- | --- |
| **Pva** | Cuadrada: salta (o sube en rampa) a PEEP + Pinsp y se mantiene plana. **Ppico ≈ PEEP + Pinsp con independencia de R y C** | PEEP |
| **Flujo** | Pico inicial ΔP/R y decaimiento exponencial; si Tinsp ≥ 3–4 τ el flujo llega a ~0 antes de ciclar (fase plana) | Exponencial negativa, como en VC |
| **Volumen** | Exponencial saturante hacia C·ΔP; VT = C·ΔP·(1 − e^(−Tinsp/τ)) | Exponencial hacia el equilibrio |

Cifras del banco PC (BM-03 PC, SC-13): Pinsp 10 sobre PEEP 5, R 10, C 0,05, Tinsp 1 s = 2 τ:

- Flujo pico = 10/10 = 1 L/s = **60 L/min**; flujo al final de la inspiración = e⁻² L/s = 0,1353 L/s ≈ **8,1 L/min** (el flujo no ha llegado a cero: Tinsp es sólo 2 τ).
- VT = 0,05·10·(1 − e⁻²) = **0,4323 L ≈ 432 mL**; el máximo alcanzable con Tinsp → ∞ es C·ΔP = 500 mL.
- Ppico = 15 cmH₂O. Sin oclusión, el final de la inspiración en PC no es una meseta válida: Pplat de ciclo se publica como `noOcclusion` (P, dossier §11).

Consecuencias didácticas:

- **Flujo que vuelve a cero antes de ciclar** significa Tinsp ≥ ~3–4 τ: alargar más el Tinsp no añade volumen (sólo acorta Tesp). **Flujo que termina por encima de cero** significa Tinsp < 3 τ: el VT está por debajo de C·ΔP y alargar Tinsp lo aumentará (D: Messina y Olarewaju 2023 describen el flujo que «termina prematuramente sin volver a cero» como signo de Tinsp insuficiente).
- **Rampa** (`riseMs`): el objetivo se acerca a PEEP + Pinsp como una exponencial de primer orden (≈95 % en `riseMs`, τ = `riseMs`/3); el flujo pico se reduce y se retrasa, y el VT baja ligeramente para el mismo Tinsp (BM-03 PC con rampa 200 ms: VT < 432 mL). La validación rechaza rampa > Tinsp.
- **Tope del actuador**: el flujo del ventilador virtual no supera 160 L/min (D ficha 2014, flujo inspiratorio adulto 2–160 L/min). Con R muy baja el flujo libre ΔP/R excedería el tope; entonces el motor entrega 160 L/min como fuente de flujo y **la presión queda por debajo del objetivo** hasta que la presión elástica sube lo suficiente (BM-03 PC, tercer caso).

### 3.2 Efecto de cada parámetro en PC (paciente pasivo)

| Cambio | Pva | Flujo | Volumen | Por qué |
| --- | --- | --- | --- | --- |
| ↑ Pinsp | ↑ Ppico en ΔPinsp | ↑ pico (ΔP/R) | ↑ VT proporcional a ΔP | ΔP es la única consigna de volumen |
| ↑ PEEP (Pinsp fijo) | Toda la curva sube; Ppico = nuevo PEEP + Pinsp | Igual forma; transitorio de entrada de C·ΔPEEP en 3–4 τ | Mismo VT en régimen (ΔP relativo se conserva); V absoluto más alto | El volumen se conserva al cambiar; el pulmón converge al nuevo equilibrio (residuo e⁻⁶ por ciclo en el banco) |
| ↑ Tinsp (↑ I:E o ↓ FR) | Meseta más larga | Llega más cerca de cero | ↑ VT hasta saturar en C·ΔP | V = C·ΔP·(1 − e^(−Tinsp/τ)) |
| ↓ Tinsp (↑ FR con I:E fijo) | Meseta más corta | Se corta por encima de cero | ↓ VT | Menos constantes de tiempo |
| ↑ rampa | Subida inclinada en vez de escalón | Pico menor y más tardío | ↓ VT leve para el mismo Tinsp | El objetivo tarda en alcanzarse |
| ↓ C | **Sin cambio de Ppico** | Mismo pico ΔP/R; decae más rápido (τ menor) | ↓ VT hacia C·ΔP | La presión es la consigna; el volumen la consecuencia |
| ↑ Rinsp | **Sin cambio de Ppico** | ↓ pico ΔP/R (duplicar R halva el pico); decae más lento | ↓ VT para el mismo Tinsp | τ más larga: en Tinsp fijo entran menos constantes de tiempo |
| Esfuerzo (Pmus > 0) | **Sin cambio de Ppico** (la fuente de presión lo absorbe) | ↑ flujo: Q = (Pva + Pmus − Pel)/R | ↑ VT | En fuente de presión el esfuerzo se suma al gradiente que mueve gas |

**Regla de oro, opuesta en cada modo** (D: Mireles-Cabodevila y Chatburn 2025): en VC el volumen es la consigna y la presión revela la mecánica; en PC la presión es la consigna y el volumen (y el flujo) revelan la mecánica. Un cambio de R o C que en VC aparece en Ppico/Pplat, en PC aparece en VTe.

## 4. CPAP/PS: fuente de presión ciclada por el flujo del paciente

En CPAP/PS no hay frecuencia ni tiempo inspiratorio programados: el paciente dispara cada respiración (disparo por flujo o por presión, como en A/C) y el controlador (`inspSupport`) impone Pva objetivo = PEEP + PS con la misma rampa de primer orden de PC (D ficha 2014: «Presión Soporte sobre nivel PEEP 0 a 60 cm H2O», «Tiempo de Rampa en PS … sólo para respiración soportada»). La diferencia está en el final: la inspiración termina cuando el flujo inspiratorio cae al porcentaje programado de su pico (D ficha 2014: «Trigger Espiratorio: 5 a 80 % de flujo pico»), o, si no llega, a los 3 s (P, U-52). Sin esfuerzo no hay respiración: la frecuencia mínima entrega una respiración por presión (Pinsp y Tinsp de respaldo) cuando pasan 60/FRmín s sin ninguna, y el tiempo de apnea (D 5–60 s) dispara la alarma y un respaldo a 12/min (P) hasta que el paciente vuelve a disparar. E-084 (D) y E-085 (P).

### 4.1 Forma esperada (paciente activo, Pmus con subida y relajación exponencial)

    Q(t) = (PS + Pmus(t) − Pel(t))/R        cicla cuando Q ≤ ETS · Qpico        VT no es una consigna: sale de PS, Pmus, R y C

| Curva | Inspiración | Espiración |
| --- | --- | --- |
| **Pva** | Sube en rampa a PEEP + PS y se mantiene plana; **Ppico = PEEP + PS con independencia de R, C y del esfuerzo** (la fuente de presión lo absorbe) | PEEP |
| **Flujo** | Pico temprano (PS + Pmus)/R y decaimiento; la inspiración se corta **antes de que el flujo llegue a cero**, exactamente al porcentaje de ciclaje | Exponencial negativa |
| **Volumen** | Crece mientras dura el soporte; cada respiración puede diferir de la anterior porque Pmus cambia | Hacia el equilibrio |

Cifras del banco PHY-03 (`tests/unit/soporte.test.ts`): PS 10 sobre PEEP 5, R 10, C 0,05, Pmus 8 cmH₂O en medio seno de 0,8 s a 15/min, rampa 100 ms, ciclaje 25 %:

- Ppico = **15 cmH₂O** en todas las respiraciones; flujo pico ≈ **73 L/min**; Ti ≈ **0,64 s**; VTe ≈ **570 mL**. Con ciclaje al 50 %: Ti ≈ 0,54 s y VTe ≈ 527 mL; al 10 %: Ti ≈ 0,70 s y VTe ≈ 582 mL.
- PS 15: VTe ≈ 748 mL; PS 5: ≈ 393 mL; Pmus 4 en vez de 8: ≈ 461 mL. El volumen es la suma de lo que ponen el ventilador y el paciente: **en soporte, VT no mide la mecánica, mide la mecánica más el esfuerzo**.
- R 25 (τ = 1,25 s): flujo pico ≈ 35 L/min, Ti ≈ 0,74 s, VTe ≈ 321 mL: el flujo tarda más en caer al 25 % de un pico más bajo, así que la inspiración se alarga mientras el volumen baja. Es el **ciclado tardío** del paciente obstructivo (D: Mireles-Cabodevila y Chatburn 2025 sobre asincronía de ciclado; Messina y Olarewaju 2023): el remedio en el simulador es subir el porcentaje de ciclaje.

### 4.2 Efecto de cada parámetro en CPAP/PS

| Cambio | Pva | Flujo | Volumen | Por qué |
| --- | --- | --- | --- | --- |
| ↑ PS | ↑ Ppico en ΔPS | ↑ pico (PS + Pmus)/R | ↑ VT | Más gradiente para el mismo esfuerzo |
| ↑ ciclaje (% del pico) | Meseta más corta | Se corta más arriba | ↓ VT | Termina antes de que entre el volumen lento |
| ↓ ciclaje | Meseta más larga | Llega más cerca de cero | ↑ VT leve; riesgo de Ti > Ti neural | El tope de 3 s corta lo que el flujo no cierra |
| ↑ Rinsp | **Sin cambio de Ppico** | ↓ pico; decae más lento | ↓ VT y ↑ Ti | τ más larga: el 25 % del pico llega más tarde |
| ↓ C | **Sin cambio de Ppico** | Mismo pico; decae más rápido | ↓ VT y ↓ Ti | τ más corta |
| ↑ Pmus | Sin cambio de Ppico | ↑ pico y ↑ flujo durante el esfuerzo | ↑ VT | El paciente pone parte del gradiente |
| Sin esfuerzo | Respiraciones de respaldo a PEEP + Pinsp de respaldo (forma de PC) | Decaimiento de PC | C·ΔP·(1 − e^(−Tinsp/τ)) | Frecuencia mínima o apnea (alarma alta) |

**Regla de oro:** en A/C VC el volumen es la consigna; en A/C PC lo es la presión y el volumen revela la mecánica; en CPAP/PS la presión es la consigna, **el paciente decide cuándo y cuánto**, y el volumen revela la mecánica *y* el esfuerzo. FR espont y VMesp espont cuentan sólo estas respiraciones: las asistidas de A/C, aunque las dispare el paciente, las cicla el ventilador.

## 5. Auto-PEEP y atrapamiento aéreo

La espiración es pasiva y se resuelve como fuente de presión a PEEP: el volumen decae hacia el equilibrio con τ_exp = Rexp·C. La válvula espiratoria mantiene la PEEP mientras el paciente no demande más que el **flujo de base** programado (D ficha 2014: 2–10 L/min en pasos de 0,5; ajuste `biasFlow`, 2 L/min por omisión, P); si un esfuerzo pide más, el circuito pasa a fuente de flujo al tope y la **Pva cae por debajo de PEEP** (la deflexión que se observa antes de un disparo, o en un esfuerzo ineficaz). El disparo puede ser **por flujo** (el paciente desvía al menos el umbral del flujo de base, por eso el umbral no puede superar el flujo de base) o **por presión** (D ficha 2014: −10 a −0,25 cmH₂O bajo PEEP). Con asistencia apagada, el flujo de base limita lo que el paciente puede inhalar durante la espiración. Si se activa la **resistencia de la rama espiratoria** (0–6 cmH₂O·s/L, E-041), la Pva en la pieza en Y queda por encima de PEEP mientras sale gas, Pva = PEEP + R_rama·|Q|, y el flujo espiratorio pico se reduce a (Pplat − PEEP)/(Rexp + R_rama). Si el siguiente ciclo llega antes de 3–4 τ_exp, queda volumen sin espirar y su presión elástica se suma a la PEEP externa: PEEPtot = PEEPe + PEEPi, con PEEPi = V_atrapado/C. En el motor la auto-PEEP **emerge** del vaciamiento incompleto; no es un parámetro ajustable (P, escenario SC-03).

Causas en el modelo: τ_exp larga (↑ Rexp o ↑ C), Tesp corto (↑ FR, I:E alto, Tinsp largo o pausa larga) o VT grande respecto de lo que cabe vaciar. Con FR 25, I:E 1:1 y Rexp 30 (SC-03): Tesp 1,2 s frente a τ_exp 1,5 s (< 1 τ), PEEPtot claramente > PEEP.

Cómo verlo:

| Señal | Qué se observa | Fuente |
| --- | --- | --- |
| Curva de flujo | El flujo espiratorio **no vuelve a cero** antes de la siguiente inspiración; el ciclo siguiente arranca desde un flujo negativo | D: Mellema 2013 («la espiración no ha terminado cuando llega la siguiente respiración»); Messina y Olarewaju 2023 |
| Bloqueo espiratorio | El circuito se ocluye al final de la espiración (Q = 0); la presión sube desde PEEPe hasta PEEPtot; PEEPi = PEEPtot − PEEPe medida justo antes de ocluir. Válido sólo con meseta estable (≤ 0,5 cmH₂O) y duración completa; el esfuerzo lo invalida con motivo | D: Natalini et al. 2016 (oclusiones teleespiratorias de 4 s, auto-PEEP = PEEPtot − PEEP aplicada); implementación P |
| Pplat y Ppico en VC | Suben en PEEPi sin que cambien VT, R ni C; la Cstat calculada con PEEPe en el denominador queda subestimada porque la presión de partida real es PEEPtot | P (el motor usa Pplat − PEEPe y lo declara en `reason`) |
| Bucle P-V | El bucle no cierra en el mismo punto: el final de la espiración queda desplazado en volumen respecto del inicio, y toda la asa se desplaza hacia presiones más altas | P (coherente con Mellema 2013) |
| Bucle F-V | La rama espiratoria no llega al eje de flujo cero al volver al origen | P |
| Panel docente | PEEPi «verdad del modelo» al inicio del último ciclo (Pel − PEEP) y τ espiratoria; la medición del ventilador es la del bloqueo | P |

Remedios en el simulador: alargar Tesp (↓ FR, I:E más bajo, ↓ pausa), reducir VT o, si el escenario lo permite, bajar Rexp. Alargar Tesp a ≥ 3 s en SC-03 reduce PEEPi por debajo de 0,3 cmH₂O.

## 6. Bucles

| Bucle | Forma esperada en VC (flujo constante) | Forma esperada en PC | Señales de alarma |
| --- | --- | --- | --- |
| **P-V** (presión en x, volumen en y) | Asa en sentido antihorario; rama inspiratoria inclinada con un desplazamiento inicial hacia la derecha igual a R·Q; el área entre ramas crece con R y con Q; la pendiente entre inicio y fin de inspiración es la distensibilidad dinámica | Rama inspiratoria que se hace casi vertical al final (presión constante mientras entra volumen) | «Pico» o **beak** en el extremo superior: la presión sigue subiendo con poco volumen adicional (sobredistensión; el modelo lineal sólo lo reproduce si se baja C a mitad de escenario, no por sí mismo); inicio de la asa desplazado en volumen: atrapamiento |
| **F-V** (volumen en x, flujo en y) | Rama inspiratoria plana (flujo constante); rama espiratoria con pico inmediato y caída exponencial hasta el origen | Rama inspiratoria con pico inicial y decaimiento; espiratoria igual que en VC | Rama espiratoria que no llega a cero: auto-PEEP; caída espiratoria cóncava y lenta: ↑ Rexp |

Descripción D (Mellema 2013): en PC la porción final de la rama inspiratoria del P-V aparece casi vertical; el beak refleja aumentos de presión con incremento mínimo de volumen. Con compliance constante el modelo **no** genera beak espontáneo; con la sigmoide de Venegas activada (E-048) sí (§8); lo que el alumno verá es una asa lineal que rota cuando C cambia.

## 7. Verificación en el simulador

Cada afirmación anterior está anclada en una prueba automática (`npm test`). Se citan las expectativas numéricas tal como están escritas en el código; tolerancias del dossier §26: presión ±0,5 cmH₂O, volumen ±1 %.

| Afirmación | Prueba | Expectativa comprobada |
| --- | --- | --- |
| Ppico = PEEP + R·Q + VT/C; Pplat = PEEP + VT/C | BM-01 (`tests/bench/bm.test.ts`) | Tinsp 1,000 s; Ppico 20; VT 0,5 L; bloqueo insp. 2 s válido con Pplat 15 |
| Cstat y R se recuperan de la misma respiración | BM-02 | Cstat = 500/(15 − 5) = 50 mL/cmH₂O; R = (20 − 15)/0,5 = 10 |
| Fuente de presión ideal: Q y V exponenciales | BM-03 (modelo) | ΔP 10, R 10, C 0,05, 1 s: VT 0,432332 L; Q₀ 1 L/s; Q_fin 0,135335 L/s |
| Espiración incompleta produce presión elástica residual | BM-04 | Rexp 20, C 0,05, exceso 0,5 L, Te 0,5 s (= 0,5 τ): exceso final 0,303265 L; Pel extra 6,0653 cmH₂O |
| Coherencia de unidades | BM-05 | 0,5 L/s → 30 L/min; C 0,05 → 50 mL/cmH₂O; VTe de banco 500 mL |
| Plimit sostiene presión, el flujo cae, VT < programado, ciclo por tiempo | BM-06a | C 0,02, Plimit 25 < Pmáx 40: cruce a 0,6 s; Ppico 25; Tinsp 1 s; VT 0,38647 L (0,3 L a flujo + 0,1·(1 − e⁻²) L a presión); alarma Pmáx inactiva |
| Pmáx termina la inspiración y activa la alarma | BM-06b | Pmáx 30 < Plimit 60: Tinsp 0,8 s; VT 0,4 L; Ppico 30; causa `pmax`; acción `endInspiration` |
| No se fuerza el VT bajo límites | BM-06c | Ajuste VT 0,5 L; VTe medida < 0,45 L |
| Conservación de volumen sin fuga | BM-07 (VC) y «BM-07 en PC» (`pc.test.ts`) | VTinsp − VTe = ΔV absoluto por respiración y acumulado en 10 (VC) / 8 (PC) respiraciones |
| El integrador converge y los eventos no dependen del paso | BM-08 | Errores de VT decrecientes para dt 4, 2, 1 ms frente a la solución analítica; Tinsp 0,75 s idéntico con dt 4 y 1 ms |
| PC ideal en el motor: Ppico = PEEP + Pinsp, flujo decreciente, sin Pplat | BM-03 PC (`tests/bench/pc.test.ts`) | Tinsp 1 s; VT 0,432332 L; flujo pico e^(−0,004/0,5) L/s (leído al final del primer sub-paso de 4 ms); Q_fin 0,1353 L/s (≈ 8,1 L/min); Ppico 15; Pplat de ciclo `null` con motivo `noOcclusion` |
| La rampa retrasa la entrega | BM-03 PC (rampa 200 ms) | VT < 0,432332 L y dentro del 1 % de una referencia Euler a 10 µs |
| Tope del actuador 160 L/min | BM-03 PC (R 1, Pinsp 20) | Flujo pico ≤ 160/60 L/s; VT dentro del 1 % de la referencia con flujo acotado |
| Duplicar R halva el flujo pico y baja el VT; Ppico igual | PHY-02 (`pc.test.ts`) | Q_pico(R 20)/Q_pico(R 10) = 0,50; VT menor; Ppico igual a 6 decimales |
| Halvar C reduce el VT hacia C·ΔP y acorta τ | PHY-02 | Tinsp 3 s: VT = 0,05·10·(1 − e⁻⁶) con C 0,05 y 0,025·10·(1 − e⁻¹²) con C 0,025 |
| Tinsp más largo satura el VT; flujo final ≈ 0 | PHY-02 | Tinsp 0,5 s (= τ): VT = 0,5·(1 − e⁻¹); Tinsp 3 s (= 6 τ): VT = 0,5·(1 − e⁻⁶); flujo final < 0,01 L/s |
| Cambiar PEEP en PC conserva V y desplaza la base | PHY-02 | PEEP 5 → 10: V continuo; PEEPe 10; Ppico 20; VT ≈ 0,4323 L (±0,005) |
| El esfuerzo aumenta flujo y VT sin cambiar Ppico | PHY-02 | Pmus 5 cmH₂O a 15/min: Ppico igual; VT mayor |
| Validación PC y transacción VC → PC | PHY-02 | PEEP + Pinsp ≥ Pmáx rechazado; rampa > Tinsp rechazado; el modo cambia en la siguiente respiración; Ppico 17 con Pinsp 12 |
| CPAP/PS: espontáneas a PEEP + PS cicladas por flujo | PHY-03a (`tests/unit/soporte.test.ts`) | PS 10, PEEP 5, Pmus 8 a 15/min: todas `spontaneous` con causa `flow`; Ppico 15 (±0,5); la última muestra inspiratoria está entre el 22 y el 26 % del flujo pico; FR = FR espont ≈ 15; VMesp espont = VMesp; VTesp espont válido |
| El porcentaje de ciclaje gobierna el Ti; R alta lo alarga (ciclado tardío) | PHY-03a | Ti(50 %) < Ti(25 %) − 0,05 s; Ti(R 25) > Ti(R 10) + 0,1 s |
| Tope de tiempo del soporte | PHY-03a | τ 2 s y ciclaje 5 %: respiraciones con causa `tiMax` y Ti = 3,00 s |
| Apnea: alarma alta y respaldo por presión a 12/min | PHY-03b | Sin esfuerzo: ninguna respiración antes de 20 s; alarma `apnea` activa entre 20,0 y 20,1 s, banda roja; primera `backup` con Ppico 17 (PEEP 5 + 12) y Tinsp 1,00 s; la siguiente 5 s después |
| El disparo del paciente termina la apnea y el respaldo | PHY-03b | Tras dos de respaldo, al activar el esfuerzo aparece una `spontaneous`, la alarma se resuelve y no vuelve a haber respaldo |
| Frecuencia mínima entre espontáneas | PHY-03b | Paciente a 6/min y FRmín 10: hay `spontaneous` y `mandatory`, ninguna `backup` ni apnea; FR espont ≈ 6 y FR > FR espont + 3; Ppico 17 en las obligatorias y 15 en las espontáneas |
| Validación CPAP/PS y transacción A/C → CPAP/PS | PHY-03c | PEEP + PS ≥ Pmáx y PEEP + Pinsp de respaldo ≥ Pmáx rechazados; FRmín 60 con Tinsp 1 s rechazado; ciclaje 27 % rechazado y 30 % aceptado; tras cambiar de modo con paciente activo, todas las nuevas son `spontaneous` (sin obligatoria colada) |
| Sesiones anteriores sin los ajustes de CPAP/PS | PHY-03c | Importación aceptada con aviso «completados con el valor por omisión» |
| Retardo de disparo y trabajo de disparo | SYN-04 (`tests/unit/sync.test.ts`) | Inicio de la asistida 80 ± 4 ms tras la detección; Pva 1–3 cmH₂O bajo PEEP en ese lapso con Pmus 8 y base 4; menor con base 10 o Pmus 4; > 3 con disparo por presión a −2; sin disparo asistido la Pva no baja de PEEP |
| Potencia mecánica: integral exacta = solución cerrada = fórmula de flujo constante | POT-01 (`tests/unit/potencia.test.ts`) | Banco: 7,5 cmH₂O·L por respiración (±1 %) y 11,0 J/min = 0,098·15·0,5·[20 − ½(15 − 5)] (±1,2 %); FR 20 → ×1,25 o más; VT 0,35 → menos que ×0,7 |
| Potencia en PC con presión constante | POT-02 | Rampa 0: (PEEP + Pinsp)·VT = 15 · 0,4323 cmH₂O·L (±1 %) |
| Calidad de la potencia | POT-03 | `inProgress` con una respiración, `valid` con tres, `unavailable` en espera |
| Fuga en la Y: entregado ≠ recibido, PEEP y autodisparo | LEAK-01..04 (`tests/unit/fuga.test.ts`) | Fuga 6 L/min a 10 cmH₂O: VTi = VT programado, VTe < VTi, fuga volumétrica ≈ ∫G·Py/VTi y el pulmón recibe VTi − fuga inspiratoria; con base 4 la PEEP se sostiene y hay autodisparo con umbral 2, ninguno con umbral 4; con base 2 la PEEP cae a bias/G; sin fuga todo idéntico |
| Circuito compresible: el sensor de la máquina ve más de lo que el pulmón recibe | BM-CC (`tests/bench/circuito.test.ts`) | C 0,05, Cc 0,002 (2 mL/cmH₂O), VC VT 0,5 L, PEEP 5, pausa 0,3 s: VT pulmonar ≈ 480,8 mL (= 500·50/52), Pplat−PEEP ≈ 9,64, Cstat del bloqueo 51,9 mL/cmH₂O ≈ C+Cc, VTi = VTe = 500 mL y el flujo espiratorio inicial no supera el tope del actuador |
| Sin compliance en el circuito todo vuelve a ser idéntico | CIR-01 (`tests/unit/circuitoIdentidad.test.ts`) | Con Cc = 0 o ausente, las trazas de 10 s de SC-01 y SC-13 son bit a bit las de antes; en PC con Cc > 0 el volumen pulmonar no cambia y el sensor ve más flujo |
| Desconexión: sin presión, sin volumen, alarma alta que se resuelve al reconectar | LEAK-05 | Circuito abierto: Ppico < 1, VTe < 5 mL, `disconnect` activa y banda roja en dos respiraciones; al cerrar el circuito se resuelve y queda pendiente de reconocer |
| Cambiar PEEP en VC no suma PEEP dos veces | PHY-06 (`tests/unit/physics.test.ts`) | PEEP 5 → 10: PEEPe 10; Pplat 20 (< 21; 25 delataría el error); Cstat 50 |
| La auto-PEEP emerge del vaciamiento | PHY-07 | Rexp 30, Tesp corto: PEEPtot > 5,5 y PEEPi > 0,5; tras alargar Tesp PEEPi menor y < 0,3 |
| R sube Ppico y no Pplat; C sube ambos | PHY-08 | Rinsp 10 → 20: Ppico +5, Pplat igual; C 0,05 → 0,025: Ppico +10 y Pplat +10 |
| Esfuerzo que supera el trigger dispara asistidas | PHY-08 | FR medida > 15 con esfuerzo activo |
| Dominio de fallo sin NaN | PHY-10 | Rinsp 60, C 5 mL/cmH₂O: Tinsp 0,05 s; VT 0,025 L; Ppico 40 (Pmáx) |
| Meseta inestable con esfuerzo se invalida | PRC-02 (`tests/unit/procedures.test.ts`), SC-10 | Bloqueo inválido por `mesetaInestable`; sin Cstat |

Escenarios que ejercitan cada fenómeno en la interfaz (`src/scenarios/index.ts`): SC-01 relaciones VC y separación resistiva/elástica; SC-02 ↓ C (Ppico y Pplat suben juntos); SC-03 ↑ Rexp y Tesp corto (auto-PEEP, bloqueo espiratorio); SC-04 ↑ Rinsp con Plimit (VTe < VT); SC-05 esfuerzo débil y trigger; SC-09 Rinsp extrema y Pmáx; SC-10 bloqueo inválido por esfuerzo; SC-12 sensor de O₂ (no mecánica); SC-13 PC con R duplicada a 30 s (flujo pico a la mitad, VTe cae, Ppico no cambia; I:E 1:1 acerca VT a 500 mL); SC-P referencia visual de las fotografías (C y R artificiales). Los escenarios SC-06, SC-07, SC-08 y SC-11 no existen en el catálogo actual.

Cobertura L3 (revisión experta clínica): pendiente, como consta en `01-resultados.md`.

## 8. Límites explícitos del modelo

| Simplificación | Consecuencia observable | Marca |
| --- | --- | --- |
| Un compartimento estático más un cuerpo de Maxwell opcional (E2, τ2) | Con E2 = 0 la presión cae de Ppico a Pplat instantáneamente. Con E2 > 0 aparece la relajación de esfuerzo: caída inmediata resistiva hasta P1 y decaimiento exponencial hasta P2, la diferencia entre elastancia dinámica y estática. Las unidades rápidas y lentas en paralelo existen desde v0.4.3 como opción (E-051): con una sola unidad no hay pendelluft | D el modelo (Mount, Bates, D'Angelo); P los valores (E-044, U-37) |
| Compliance lineal por omisión, sigmoide de Venegas opcional | Con la curva lineal el bucle P-V es una recta. Con la sigmoide aparecen el codo inferior, la compliance máxima en c y el pico de sobredistensión arriba; la compliance medida depende de la PEEP | D la ecuación; P los valores (E-048, U-39) |
| Limitación al flujo espiratorio opcional (resistor de Starling) | Sin ella la espiración es un vaciamiento exponencial hacia PEEP en cualquier obstructivo. Con ella el flujo se hace independiente del esfuerzo y de la presión aguas abajo, el pulmón atrapa hasta que su retroceso iguala la presión crítica y la PEEP externa hasta ese punto abre la vía aérea | D el modelo; P los valores (E-049, U-40) |
| Resistencia espiratoria dependiente del volumen opcional | Con resistencia constante el flujo es exactamente proporcional al volumen y la rama espiratoria del bucle es una recta; con dependencia queda excavada | D la dependencia; P la forma y los valores (E-050, U-40) |
| Segunda unidad alveolar en paralelo opcional | Con una sola unidad el flujo espiratorio es monoexponencial y la meseta no depende de la duración de la oclusión. Con dos aparecen la cola lenta, la meseta que sigue bajando y el pendelluft con el circuito cerrado | D el modelo; P los valores y que la segunda unidad sea lineal (E-051, U-41) |
| Sin inertancia | La presión responde al flujo sin retardo; no hay oscilaciones ni sobreimpulso al inicio del flujo | P |
| Resistencia de Rohrer R(Q) = K1 + K2·\|Q\| disponible como parámetro | Con K2 > 0 la caída resistiva crece más que proporcionalmente con el flujo; con K2 = 0 (por omisión) el modelo es lineal | D el modelo; P los valores (E-046, U-37) |
| Compliance del circuito opcional (0–5 mL/cmH₂O en el panel docente; 0 por omisión = comportamiento anterior); sin inertancia | El sensor de flujo es de la máquina: con Cc > 0 el VTi se mantiene pero el pulmón recibe menos, la meseta baja y la Cstat medida por bloqueo sale ≈ C + Cc; el gas comprimido vuelve por la válvula espiratoria repartido en varios pasos (tope del actuador) | D el fenómeno; P el valor y las simplificaciones (§9) |
| Fuga lineal en la pieza en Y (Qfuga = G·Py), sin compensación; desconexión como fuga muy grande | VTi (lo entregado) supera a VTe (lo que vuelve por la válvula) y la tabla lo publica como fuga volumétrica; la PEEP sólo se sostiene mientras el flujo de base cubra la fuga; el sensor de flujo ve salir gas de forma continua y dispara solo si supera el umbral (autodisparo); con el circuito abierto el nodo queda en ≈ 0 cmH₂O, no vuelve volumen y se declara «Paciente desconectado» (Ppico < 3 y VTe < 20 mL). Sin PEEP en el circuito (Pva 3 bajo la programada) no se evalúa el disparo. El equipo real compensa la fuga y detecta la desconexión con criterios propios | P (E-088, U-10) |
| Rampa de PC de primer orden (≈95 % en `riseMs`) y tope de 160 L/min dentro del integrador | Forma de la subida y comportamiento con R muy baja son aproximaciones del simulador, no del equipo; el tope se aplica en cada etapa del RK2, sin sobreimpulso dependiente de dt (R3-01) | P (tope D ficha 2014; forma U) |
| Apertura de la válvula espiratoria en 40 ms (0 en el banco) | La Pva no salta de Ppico a PEEP: pierde primero lo resistivo y luego baja mientras la válvula abre; el flujo espiratorio alcanza su pico tras la apertura | P (E-052, U-42) |
| Válvula espiratoria con flujo de base programable (2–10 L/min) y resistencia de rama opcional (0–6 cmH₂O·s/L, 0 por omisión) | Con 0 el flujo espiratorio pico no está acotado (picos irreales con Rexp muy baja); con resistencia de rama queda acotado y la Pva sube sobre PEEP al espirar | D rangos; P valores por omisión (E-038, E-041) |
| Disparo por flujo o por presión, referido a la PEEP programada | Sin compensación de fugas ni ventana de disparo del 80 % de Tesp | D existencia; P detalle (E-039) |
| Esfuerzo como pulso de Pmus independiente del reloj del ventilador, con dos formas ('halfSine' y 'riseRelax') | Reproduce disparo, asincronía por fase y mesetas inestables, no la modulación neural real ni la respuesta al CO₂ | P |
| Sin adaptación de flujo tras Plimit en respiraciones sucesivas | El equipo real ajusta el flujo en las respiraciones siguientes (JB72469XX); aquí cada respiración se limita igual | U-19 |
| Canal de volumen con dispersión de lectura (±2,5 % por ciclo) separado del volumen verdadero | VTesp y VMesp mostrados cambian entre ciclos aunque el modelo entregue exactamente el VT programado; las referencias analíticas del banco se leen del volumen verdadero, con el ruido apagado | D envolvente ±10 % (ficha 2014); P dispersión típica (E-042, U-36) |
| Sigmoide unívoca más reclutamiento opcional con histéresis (`recruit`): una fracción `frac` de la capacidad elástica está cerrada mientras la distensión no supere `pOpen`; abierta, se conserva hasta caer de `pClose` (< `pOpen`). Apertura y cierre exponenciales (`tauOpenS`, `tauCloseS`); capacidad efectiva C·(1 + r·frac), también sobre la sigmoide | La PEEP decremental ya se puede enseñar: en banco, con pOpen 28/pClose 9/frac 0,6 y C basal 30, la Cstat medida a PEEP ≤ 12 vale 30 mL/cmH₂O sin haber abierto y ≈ 48 tras mantener PEEP 20 — la misma consigna, compliances distintas según la historia. Una oclusión sostenida recluta y su meseta cae al abrirse. Un único par de umbrales por compartimento: no hay continuo de unidades con umbrales dispersos | P (U-47 resuelta, E-093) |
| Espiración activa como medio seno negativo opcional (`expAmplitude`), que arranca al final de la inspiración neural y se suma a la cola de relajación | Reproduce vaciamiento bajo la FRC, pico espiratorio mayor y meseta inestable por contracción espiratoria; en PC/PS la fuente de presión absorbe el flujo negativo con Pva fija (válvula espiratoria ideal); no hay frenado espiratorio ni disparo reverso | P (U-48 parcialmente cerrada) |
| Ciclado del soporte resuelto al final del paso de 4 ms; Ti máximo 3 s; respaldo por apnea a 12/min hasta el primer disparo del paciente | El flujo de ciclado queda hasta un paso por debajo del porcentaje exacto (≈ 0,4 % del pico con τ 0,5 s); un equipo real fija su propio tope de tiempo y su propia salida del respaldo, no publicados | P (E-085, U-52) |
| Retardo de respuesta del disparo por tipo: 80 ms por flujo, 110 ms por presión (la caída debe propagarse y medirse en la rama), sin dinámica de válvula ni compensación | Entre el cruce del umbral y la apertura de la válvula inspiratoria el paciente sigue tirando del flujo de base: con Pmus 8 y flujo de base 4 L/min la Pva cae ≈ 2 cmH₂O bajo PEEP, y más con disparo por presión (umbral ya rebajado al detectar + retardo mayor). Es el **trabajo de disparo** que se ve en la curva de presión; bancos ICU publican 60–100 ms por flujo y 100–150 ms por presión | P (E-086, U-53) |
| Regulador de PEEP con ancho de banda finito: caída K·(demanda no compensada) con K = 3 cmH₂O·s/L y recuperación integral τ = 0,1 s | Una demanda inspiratoria repentina del paciente hunde la Pva transitoriamente y el regulador la repone en régimen (medido: 0,74 con Pmus 8 y base 8 L/min; 3,9 con Pmus 12; 1,6 con base 4). La caída sólo aparece cuando el esfuerzo tira gas (supera la PEEP intrínseca); un esfuerzo que no llega deja la muesca sólo en el **flujo**. Ancho de banda real del equipo no publicado | P (E-091, U-43) |
| Con dos unidades, lo que el equipo mide no es lo que el pulmón tiene | Es una propiedad del sistema real, no un defecto del modelo, y por eso importa enseñarla: en SC-17 una oclusión de 2 s da Cstat 45,6 frente a 60 verdadera (−24 %) y una resistencia aparente (Ppico−Pplat)/Q de 9,66 frente a 4,88 del paralelo (+98 %); a 15 s la resistencia aparente llega a 14,61. **La fórmula que enseña SC-01 no vale en SC-17**, y hoy la aplicación no lo advierte | D el fenómeno; U la advertencia al alumno (U-49) |
| Sin intercambio gaseoso | No hay SpO₂, PaO₂, PaCO₂, EtCO₂ ni espacio muerto: cambiar la FiO₂ o la ventilación minuto no tiene consecuencia alguna más allá de la mecánica. El simulador enseña mecánica ventilatoria, no oxigenación ni ventilación alveolar | — |
| Sin datos de pacientes reales | Todas las cifras son analíticas o sintéticas; el simulador no valida ajustes clínicos ni pretende fidelidad numérica con el equipo (U-18) | — |

**Valores de referencia (presets del panel docente, U-37).** Los deslizadores de E₂/τ₂ y K₂ siguen valiendo 0 por omisión, pero el panel ofrece presets fisiológicos: «Adulto sano» (E₂ 3 cmH₂O/L, τ₂ 1,1 s; sistema respiratorio total anestesiado-paralizado, D’Angelo 1989/1991, oclusión rápida a flujo constante) y «Restrictivo / SDRA» (E₂ 9, τ₂ 1,0 s; 2–3× la sana) — cifras aproximadas de literatura (P). Para el tubo endotraqueal, el preset fija el K₂ inspiratorio por diámetro interno según el método de oclusión (Anaesth Intensive Care 2011;39:410, D): 2,4 cmH₂O/(L/s)² en 9,0 mm hasta 12,8 en 6,5 mm; el término lineal K₁ del tubo se considera incluido en la resistencia del paciente (P). Con el preset sano y VC 500 mL a 0,5 L/s, una oclusión de 3 s da P1−P2 ≈ 0,87 cmH₂O (≈ 2,6 con SDRA); el TET 7,0 mm sube la Ppico ≈ 2,3 cmH₂O a 0,5 L/s (`tests/bench/viscoelasticoReferencia.test.ts`, BM-VE).

Por omisión los escenarios usan la forma 'riseRelax': Pmus sube como cuarto de seno hasta el pico en `tiS` y relaja exponencialmente con τ = 0,15 s (P); la forma 'halfSine' sigue disponible. La variabilidad respiración a respiración es opcional y determinista (`variability`): la amplitud y el período de cada esfuerzo se escalan ±frac con un generador de semilla de sesión, así que reproducir una sesión repite exactamente la misma secuencia de esfuerzos (P); sin `variability` el esfuerzo queda perfectamente periódico, como antes.

**Espiración activa (opcional).** El parámetro `expAmplitude` (panel docente «Esfuerzo espiratorio», 0–15 cmH₂O) añade una contracción espiratoria como Pmus NEGATIVA en medio seno `−A·sen(π·τe/Te)` que arranca al final de la inspiración neural (τ = tiS) con duración `expTiS` (0,6 s por omisión, tope 0,8·(período − tiS)); se suma a la cola de relajación, así que la suma pasa por cero sin discontinuidad, y con variabilidad se escala por el mismo factor de amplitud del ciclo (la serie del sorteo no cambia). En fuente de presión (PC/PS/espiración) la válvula espiratoria se trata como regulador ideal: la Pva queda fija y el flujo negativo lo absorbe la fuente (simplificación declarada). Cifras del banco BM-EA (`tests/bench/espiracionActiva.test.ts`; pulmón lineal C 0,05, R 10, VC 500 mL, esfuerzo neural 8 cmH₂O a 12/min, expAmplitude 8): pico de flujo espiratorio −1,17 frente a −0,59 L/s pasivo (+98 %); el pulmón baja de su FRC durante el pulso (V_min 0,2501 frente a 0,2504 L pasivo; con amplitud 15 cae a 0,104 L y el VTe mostrado 0,605 > VTi). Con limitación al flujo espiratorio (Pcrit 8, Rus 50 %) el flujo a **volumen igual** no crece — el tope (Pel − Pcrit)/Rus es independiente del esfuerzo — aunque el pico temprano sí sube porque a volumen alto el tope queda holgado: ese contraste es el punto docente.

## 9. Circuito compresible (opcional)

El parámetro `circuitComplianceLPerCmH2O` (panel docente «Compliance del circuito», 0–5 mL/cmH₂O) da a la tubuladura una distensibilidad Cc que retiene un volumen **V_circ = Cc·Py** referido al ambiente, con Py la presión del nodo en la pieza en Y. El sensor de flujo está del lado de la máquina, igual que con la fuga, así que el flujo mostrado es **Q_mostrado = Q_pulmón + Q_fuga + dV_circ/dt**: el VTi de pantalla sigue siendo el ajustado y el VTe recupera el gas comprimido, pero el pulmón recibe menos de lo entregado — la meseta baja y la Cstat medida por bloqueo sale ≈ C + Cc, que es el punto docente (el circuito «infla» la compliance medida y en tubuladuras pediátricas roba parte del VT).

En VC la presión del nodo se resuelve por bisección a cada paso: Py tal que `Paw(qSet − Cc·(Py − Py_prev)/h) = Py` (función decreciente, raíz única), y el pulmón integra con `qPulmón`. En la pausa inspiratoria el circuito y el pulmón equilibran en el primer paso de la oclusión: Py cae hasta `Pel(V + ΔV) = Py` con `ΔV = Cc·(Py_prev − Py)` (tau de transferencia ≪ paso; el intercambio no se dibuja en el sensor). En las fases de presión (PC, PS, espiración, espera) la fuente fija el nodo y la (de)compresión se aplica como `delta = clamp(Cc·Py − V_circ, ±Q_actuador·h)` repartida en varios pasos, contada en el flujo y en el VTe mostrados; el flujo total del sensor no supera el tope del actuador.

Simplificaciones declaradas: no hay inertancia ni ondas de presión; en las fases de presión Py no se recalcula por la compliance (la fuente fija el nodo, se ignora el acople con la resistencia espiratoria); con dos unidades el reparto del gas comprimido igualó presiones estáticas. Banco BM-CC en `tests/bench/circuito.test.ts` (tabla del §7).

## Fuentes verificadas

1. Messina Z, Olarewaju O. *Pressure Controlled Ventilation*. StatPearls [Internet], NCBI Bookshelf; última actualización 31 de julio de 2023. https://www.ncbi.nlm.nih.gov/books/NBK555897/ — leído: flujo dinámico con presión en meseta; VT dependiente de C, R, esfuerzo, I:E y rampa; Tinsp determina el VT; flujo que no vuelve a cero como signo de Tinsp insuficiente.
2. Mellema MS. *Ventilator Waveforms*. Topics in Companion Animal Medicine 2013;28(3):112–123. doi:10.1053/j.tcam.2013.04.001. PDF docente (Cornell): https://confluence.cornell.edu/download/attachments/272203844/MellemaVentWaveforms.pdf — leído íntegro: escalón y subida de presión con flujo constante, PIP → Pplat en el bloqueo, flujo espiratorio que no vuelve a cero como detección de auto-PEEP sin bloqueo, rama inspiratoria casi vertical en PC y beak por sobredistensión en el P-V. (Contexto veterinario; la mecánica descrita es la general.)
3. Mireles-Cabodevila E, Chatburn RL. *The equation of motion: a brief guide to ventilator adjustment*. European Heart Journal: Acute Cardiovascular Care 2025;14(8):494–496. https://academic.oup.com/ehjacc/article/14/8/494/8195106 — leído: Pvent + Pmus = E·V + R·Q; τ = R·C; ~3 τ ≈ 95 % de la espiración; presión dependiente en VC y flujo/volumen dependientes en PC; Pplat aísla la carga elástica.
4. Chatburn RL. *How to Interpret Ventilator Waveforms Using the Taxonomy for Modes of Mechanical Ventilation*. Respiratory Care 2026;71(6):566–587. doi:10.1177/19433654251395626. PMID 41631602 — registro y resumen verificados en PubMed (E-utilities); el texto completo en SAGE devolvió HTTP 403 durante la verificación, así que sólo se cita por el resumen (derivación de la ecuación de movimiento y procedimiento de interpretación de curvas).
5. Natalini G, et al. *Effect of external PEEP in patients under controlled mechanical ventilation with an auto-PEEP of 5 cmH₂O or higher*. Annals of Intensive Care 2016. https://pmc.ncbi.nlm.nih.gov/articles/PMC4909663/ — leído: auto-PEEP medida como PEEPtot − PEEP aplicada mediante oclusiones teleespiratorias de 4 s; atrapamiento por vaciamiento incompleto y por limitación de flujo, más probable al subir la FR.

Fuentes del equipo (D) ya listadas en `02-diferencias-frente-al-dossier.md`: ficha JB23840CO (2014), curso JB72469XX (2020), guía de resolución de problemas JB79437XX (2020). No se citan fuentes que no se hayan podido abrir.
