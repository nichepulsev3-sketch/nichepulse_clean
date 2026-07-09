# NichePulse Intelligence Engine — Blueprint fundacional

Documento del comité fundador (CEO, CTO, CAIO, Principal AI Architect, Principal Software Architect, Principal Data Architect, Principal UX Architect, Principal Product Designer, Principal Security Engineer, Principal DevOps Engineer, Principal Machine Learning Engineer). Diseño conceptual puro, deliberadamente desconectado de la implementación actual de NichePulse — la adaptación del código existente es un paso posterior y separado, no este documento.

Una nota antes de empezar, porque gobierna cada decisión de diseño de aquí en adelante: la diferencia entre un producto con IA y una empresa de inteligencia no está en cuántos módulos tiene, está en qué activo acumula. Un producto acumula funcionalidades. Una empresa de inteligencia acumula conocimiento propio, verificable, que mejora con el tiempo de forma medible. Este documento diseña el sistema que produce ese activo — no el sistema que produce respuestas.

---

## Primer principio y filosofía, como restricción de diseño

*"¿Hace que NichePulse sea más inteligente y más difícil de copiar dentro de cinco años?"* No es un eslogan al principio del documento — es un filtro que se aplica literalmente a cada capa, cada motor y cada línea del roadmap de más abajo. Donde una decisión de diseño no lo supera, este documento lo dice explícitamente y la descarta, en vez de incluirla por completitud.

La consecuencia directa de "los LLM son intérpretes, no el producto" es una regla de arquitectura concreta, no una aspiración: **ningún LLM puede aparecer en el pipeline antes de que exista un veredicto**. Un LLM puede *interpretar* evidencia ya reunida, *articular* una decisión ya tomada, *redactar* una explicación ya construida — nunca puede ser el paso que decide qué es cierto. Si mañana se sustituye Claude por Gemini o por un modelo propio, el cambio debe ser invisible para el usuario precisamente porque el LLM nunca tuvo autoridad sobre el resultado, solo sobre las palabras.

---

## Arquitectura general: 12 capas

Doce capas no es un número elegido por ambición — es el número de responsabilidades genuinamente distintas que identificamos al diseñar el flujo completo desde "llega una señal de mercado" hasta "el sistema es objetivamente más inteligente que ayer". Cada capa se define por una prueba de admisión: si dos capas tienen la misma entrada y la misma salida, se fusionan; si una capa no tiene una salida que ninguna otra capa consuma, se elimina. Las 12 que siguen pasaron esa prueba — la auditoría final, al cierre del documento, revisa esto con más dureza todavía.

### 1. Data Layer
**Responsabilidad única**: capturar la realidad tal cual llega, sin interpretarla. Ninguna decisión, ninguna relación, ningún juicio de calidad ocurre aquí — solo normalización de formato, unidades y timestamp.
**Consume**: señales de mercado externas (tendencias de búsqueda, redes, marketplaces), salidas crudas de LLM, eventos de comportamiento de usuario (búsquedas, clics, guardados), resultados reales reportados.
**Produce**: hechos normalizados, con marca de tiempo y procedencia, listos para relacionarse.
**Por qué existe como capa propia**: si esta capa no fuera honesta y completa, ninguna capa posterior podría serlo — es la única capa donde "inventar un dato" es un pecado capital, no un matiz de calidad.

### 2. Knowledge Layer
**Responsabilidad única**: mantener el modelo relacional canónico — qué entidades existen (nichos, mercados, categorías, competidores, usuarios) y cómo se relacionan entre sí. No juzga si una relación es "buena", solo que es real.
**Consume**: hechos normalizados de la Data Layer.
**Produce**: un grafo consultable de entidades y relaciones — el Knowledge Graph (sección propia más abajo).
**Por qué existe como capa propia**: separar "qué existe y cómo se relaciona" de "qué significa" es lo que permite que el grafo crezca durante una década sin que cada nueva pieza de significado obligue a reescribir el modelo de datos.

### 3. Memory Layer
**Responsabilidad única**: agregar el Knowledge Graph a lo largo del TIEMPO en dos memorias distintas — Market Memory (cómo evolucionó el mercado) y User Memory (qué patrón estratégico tiene cada usuario). No almacena hechos nuevos, deriva patrones temporales de los que ya existen.
**Consume**: el Knowledge Graph, consultado en ventanas de tiempo.
**Produce**: tendencias de mercado (series temporales por nicho/categoría/país) y perfiles estratégicos de usuario.
**Por qué existe como capa propia, no fusionada con Knowledge**: Knowledge responde "¿qué es cierto ahora?"; Memory responde "¿cómo llegamos hasta aquí y qué patrón hay en el camino?" — son preguntas distintas con el mismo dato de base.

### 4. Evidence Layer
**Responsabilidad única**: para cualquier afirmación que el sistema esté a punto de hacer, reunir qué la respalda, qué la contradice y qué falta. No pesa la evidencia, no decide — la estructura.
**Consume**: Knowledge Graph + Memory Layer, para una consulta concreta.
**Produce**: un paquete de evidencia estructurado — soporte, contradicción, ausencia, y de dónde viene cada pieza.
**Por qué existe como capa propia**: es la capa que hace que "explicable" deje de ser una frase de marketing — sin ella, la Reasoning Layer razonaría sobre datos sueltos en vez de sobre un paquete verificable.

### 5. Reasoning Layer
**Responsabilidad única**: a partir del paquete de evidencia, construir una o varias hipótesis, contrastarlas contra la evidencia disponible, descartar las débiles, y producir un argumento estructurado — no una decisión final, un argumento con su fuerza indicada.
**Consume**: Evidence Bundle + Knowledge/Memory de contexto.
**Produce**: uno o varios `StructuredArgument` — hipótesis, evidencia a favor, evidencia en contra, fuerza del argumento.
**Aquí es donde cambia el papel del LLM**: hoy es habitual pedirle a un modelo "dame un veredicto"; aquí se le pide "interpreta esta evidencia y constrúyeme el argumento más fuerte posible a favor y en contra" — sigue siendo el LLM quien articula el razonamiento en lenguaje, pero el material con el que razona ya viene acotado, y el argumento resultante es una estructura de datos, no prosa suelta.

### 6. Decision Layer
**Responsabilidad única**: el único componente autorizado a producir un veredicto final. Recibe uno o varios argumentos (de la Reasoning Layer, o de varios agentes del Consejo Multiagente — ver más abajo), resuelve conflictos entre ellos, pondera evidencia, calcula confianza, y justifica la decisión.
**Consume**: `StructuredArgument`(s).
**Produce**: `Decision` — veredicto, confianza, justificación, registro de auditoría.
**Regla no negociable**: ningún otro módulo del sistema puede escribir un veredicto. Si una capa futura necesita decidir algo, pasa por aquí — es la única forma de que "por qué decidió esto el sistema" tenga siempre una única respuesta rastreable.

### 7. Prediction Layer
**Responsabilidad única**: proyectar la Decision hacia el futuro — no "es bueno ahora" sino "qué va a pasar" (probabilidad de crecimiento, de saturación, riesgo, ventana temporal).
**Consume**: `Decision` + resultados históricos reales etiquetados.
**Produce**: `Prediction` — probabilidades, incertidumbre, ventana temporal, fiabilidad.
**Por qué es una capa distinta de Decision**: Decision es un juicio sobre el presente con la evidencia de hoy; Prediction es una proyección sobre el futuro con su propio modelo de incertidumbre — confundirlas produce el error clásico de presentar una opinión bien fundada como si fuera una previsión medida. Se activa solo cuando hay suficiente historial etiquetado — en ausencia de eso, devuelve honestamente "sin predicción", nunca un número simulado.

### 8. Recommendation Layer
**Responsabilidad única**: traducir Decision + Prediction en la siguiente acción concreta para ESTE usuario — no un veredicto genérico, una recomendación personalizada usando su User Memory.
**Consume**: `Decision` + `Prediction` + User Memory.
**Produce**: `Recommendation` — acción concreta, motivo, cómo se conecta con el historial de este usuario.
**Por qué es una capa distinta de Decision**: "este nicho es bueno" (Decision) y "esto es lo que TÚ deberías hacer con él" (Recommendation) son preguntas distintas — la primera es objetiva, la segunda es personal. Es, de las 12, la capa que la auditoría final vigila más de cerca por si la señal de personalización resulta ser más débil de lo que justifica mantenerla separada.

### 9. Communication Layer
**Responsabilidad única**: convertir todo lo anterior (Decision, Prediction, Recommendation, Evidence) en lenguaje humano y en estructuras listas para UI — sin decidir nada, sin añadir ni un solo hecho nuevo, solo traducir y presentar.
**Consume**: las salidas estructuradas de las capas 6-8 y la Evidence Layer.
**Produce**: texto en lenguaje natural (en el idioma y tono del usuario), payloads de UI (tarjetas, informes, PDF).
**Por qué existe como capa propia**: es donde vive la mayor parte de la superficie de contacto con el LLM — y precisamente por eso necesita ser la capa MÁS fácil de sustituir de las 12. Cambiar de proveedor de IA debería significar tocar solo esta capa.

### 10. Learning Layer
**Responsabilidad única**: cerrar el ciclo — comparar Decisions y Predictions pasadas contra resultados reales según van llegando, y recalibrar los pesos/umbrales que usan Decision, Prediction y Confidence.
**Consume**: resultados reales + historial de decisiones/predicciones pasadas.
**Produce**: pesos y umbrales recalibrados, siempre versionados (nunca se sobreescribe en caliente).
**Distinción deliberada**: esto NO es reentrenar un modelo de IA — es ajustar los coeficientes deterministas propios de NichePulse (cuánto pesa cada señal, dónde están los umbrales de "alta confianza"). Es la capa que convierte "el sistema mejora" de una promesa en un mecanismo.

### 11. Governance Layer
**Responsabilidad única**: transversal, no un paso del pipeline — garantiza que toda Decision quede explicada, sea auditable, reproducible y versionada. Toda capa que decide algo reporta aquí.
**Consume**: cada `Decision` junto con las entradas que la produjeron.
**Produce**: un registro de auditoría inmutable y consultable, historial versionado de configuración/pesos.
**Por qué es transversal y no una capa en la cadena**: si Governance fuera un paso más del pipeline, sería el primer cuello de botella que alguien recortaría bajo presión de tiempo — al ser transversal, no hay forma de lanzar una decisión sin que quede registrada, porque no es un paso opcional intercalado, es una obligación de cada capa que decide.

### 12. Metrics Layer
**Responsabilidad única**: transversal — mide continuamente la calidad objetiva de todo el sistema (precisión, calibración, cobertura, crecimiento). Es lo que convierte "el motor es más inteligente que ayer" en un número, no en una opinión.
**Consume**: Decisions, Predictions, resultados reales, y el estado del Knowledge Graph a lo largo del tiempo.
**Produce**: series temporales de métricas de calidad (desarrolladas en detalle en la sección AI Quality).
**Relación con Governance**: Governance audita decisiones individuales ("¿por qué se decidió esto?"); Metrics audita el sistema en agregado ("¿está mejorando el sistema en su conjunto?"). Son la misma disciplina aplicada a dos escalas distintas, y por eso conviene que compartan el mismo registro de auditoría como fuente de datos, sin fusionarse en una sola capa.

**Dónde vive el Confidence Engine**: no es una 13ª capa — es una biblioteca de cálculo compartida que las capas Decision y Prediction invocan para producir sus indicadores de confianza (desarrollado en su propia sección). Convertirlo en una capa independiente en la cadena implicaría que algo "pasa por" el Confidence Engine de forma secuencial, y no es así: se consulta, no se atraviesa.

---

## Knowledge Graph: el activo que crece diez años sin romperse

El Knowledge Graph es, literalmente, el activo principal de la empresa — no la interfaz, no el modelo de IA que se use este año, no el catálogo de funcionalidades. Su valor no está en su tamaño en un momento dado, está en su tasa de crecimiento y en cuánto de ese crecimiento es reutilizable por decisiones futuras que hoy no existen.

**Entidades**: usuario, nicho, mercado (país/región), categoría, keyword, competidor, tendencia, alerta, watchlist, predicción, decisión histórica. Cada una es un nodo con identidad propia y estable — nunca texto libre repetido en cien sitios distintos.

**Relaciones**: usuario↔nicho (interactuó), nicho↔nicho (comparte categoría/keywords/mercado), nicho↔mercado (se analiza en), nicho↔competidor (compite con), nicho↔tendencia (está afectado por), decisión↔evidencia (se apoyó en), predicción↔resultado (se verificó contra).

**Principio de diseño para que aguante diez años**: el grafo debe crecer por **acumulación de relaciones sobre entidades estables**, nunca por reescritura de esquema. Esto significa dos cosas en la práctica. Primero, las entidades centrales (nicho, usuario, mercado) se definen con el mínimo de campos obligatorios posible desde el día uno — todo lo demás (categoría, ADN de producto, nivel de riesgo típico) se añade como relaciones o atributos opcionales que se pueblan progresivamente, nunca como una migración que rompe lo que ya existía. Segundo, ninguna relación se infiere sin evidencia real detrás — un grafo que "adivina" relaciones para parecer más completo es un grafo que se corrompe con el tiempo, no que crece.

**El error que evitamos deliberadamente**: migrar a una base de datos de grafos dedicada antes de que el volumen lo exija. Un modelo relacional normal de Postgres (nodos = filas, aristas = claves foráneas) es un grafo perfectamente válido a cualquier volumen que NichePulse vaya a alcanzar en años, no solo en meses — cambiar el motor de almacenamiento es una decisión de infraestructura reversible; el modelo conceptual de entidades y relaciones es la decisión que de verdad hay que acertar, porque esa sí es costosa de deshacer.

**Qué lo hace difícil de copiar**: no el esquema (cualquiera puede copiar una tabla de nichos y tags). Lo que es difícil de copiar es la HISTORIA acumulada de relaciones verificadas — diez años de "este nicho subió, este bajó, esta predicción acertó, esta no" no se replican leyendo el código fuente, solo viviendo el mismo tiempo con los mismos usuarios reales.

---

## Market Memory

No es una tabla más — es la capacidad de responder "¿cómo llegamos hasta aquí?" para cualquier nicho, categoría o mercado, no solo "¿cómo está ahora?". Debe recordar explícitamente: la evolución del score de cada nicho en el tiempo, qué predicciones se hicieron sobre él y si acertaron, qué tendencias aparecieron y desaparecieron, qué mercados crecieron o se vaciaron. Se deriva por completo del Knowledge Graph (Memory Layer, capa 3) — nunca es una copia paralela de los mismos datos, porque una copia paralela es exactamente el tipo de duplicidad que este comité tiene instrucción explícita de eliminar si aparece.

---

## User Memory: memoria estratégica, no memoria de conversación

La distinción es total. Memoria de conversación es "qué dijo el usuario en este chat" — no aporta nada a la inteligencia del sistema una vez termina la sesión. Memoria estratégica es "qué patrón de comportamiento de este usuario predice mejor sus decisiones futuras" — y esa sí compone con el tiempo.

**Filtro de admisión** (qué SÍ entra en User Memory, qué no): una interacción se promueve a memoria estratégica solo si revela una preferencia o patrón repetible — mercados que consulta con frecuencia, categorías que acepta o rechaza sistemáticamente, el nivel de score que históricamente le convence de actuar. Un clic aislado, una búsqueda sin seguimiento, una sesión abandonada: eso es ruido de la Data Layer, nunca llega a memoria. El principio es simple — si un dato no cambiaría una recomendación futura, no merece ocupar memoria estratégica, aunque sea trivial de guardar.

---

## Evidence Engine

Toda afirmación del sistema — un score, un veredicto, una predicción — debe poder desglosarse en cuatro listas honestas: qué evidencia existe a favor, qué evidencia existe en contra, qué evidencia falta, y qué incertidumbre queda incluso con toda la evidencia disponible. Ninguna de las cuatro listas se rellena por completitud — una lista vacía es una respuesta válida y frecuente, especialmente al principio de la vida de un nicho en el sistema, cuando "no hay suficiente evidencia todavía" es la verdad más útil que se puede decir.

El Evidence Engine es la capa 4 (Evidence Layer) formalizada como servicio: recibe una pregunta concreta ("¿es bueno invertir en este nicho?"), consulta Knowledge + Memory, y devuelve el paquete estructurado. No emite juicio — ese paso es exclusivo de Reasoning y Decision.

---

## Reasoning Engine

El rediseño central de todo este documento: el razonamiento deja de ocurrir dentro del LLM y pasa a ocurrir ANTES, como una secuencia explícita de pasos que cualquier ingeniero puede auditar sin necesidad de interpretar la "caja negra" de un modelo:

1. **Generar hipótesis** — a partir de la evidencia disponible, plantear una o varias lecturas posibles ("este nicho está en una fase de crecimiento sostenido" / "este nicho tiene un pico puntual, no una tendencia real").
2. **Buscar evidencia a favor de cada hipótesis** en el Evidence Bundle.
3. **Buscar contradicciones** — activamente, no solo esperar a que aparezcan.
4. **Consultar memoria** — ¿ya vimos un patrón parecido en otro nicho de esta categoría?
5. **Consultar conocimiento** — ¿qué relaciones del grafo son relevantes aquí?
6. **Consultar histórico** — ¿qué pasó la última vez que este nicho (o uno muy similar) tuvo esta pinta?
7. **Construir el argumento** — ensamblar los pasos anteriores en una estructura coherente, no en prosa todavía.
8. **Validar** — ¿el argumento se sostiene si se le quita la pieza de evidencia más fuerte? Si no, es frágil.
9. **Descartar hipótesis débiles** — las que no sobreviven al paso anterior no llegan a la Decision Layer.
10. **Generar una conclusión estructurada** — el `StructuredArgument` que consume la Decision Layer.

El LLM participa en los pasos 1 (generar hipótesis candidatas, que es un trabajo de lenguaje e intuición donde el LLM es genuinamente bueno) y en la articulación final de cada paso en texto legible — nunca en decidir cuál hipótesis gana, eso es el paso 9 y es determinista, basado en si la evidencia se sostiene o no.

---

## Decision Engine

Único componente autorizado a decidir. Recibe uno o varios `StructuredArgument` (de un solo Reasoning Layer, o de los nueve agentes del Consejo Multiagente cuando ese nivel de madurez exista) y ejecuta, en este orden:

1. **Resolución de conflictos** — si dos argumentos llegan a conclusiones distintas, no se promedia ciegamente: se examina cuál tiene evidencia más fuerte y más reciente, y si ninguno domina claramente, el conflicto se conserva y se muestra, no se disuelve artificialmente.
2. **Ponderación de evidencia** — evidencia reciente pesa más que antigua, evidencia de fuente propia (Knowledge Graph) pesa más que evidencia general del LLM, evidencia con más puntos de datos pesa más que anecdótica.
3. **Cálculo de confianza** — invoca al Confidence Engine (sección propia).
4. **Priorización de información** — cuando hay más señales de las que caben en una explicación breve, decide cuáles son las que de verdad mueven la aguja del veredicto.
5. **Justificación** — todo `Decision` sale acompañado de la razón, en una estructura que la Communication Layer puede convertir en lenguaje sin tener que inventar nada.

---

## Prediction Engine

No un score único — cinco proyecciones distintas, cada una con su propia incertidumbre: probabilidad de éxito, probabilidad de crecimiento, probabilidad de saturación, nivel de riesgo esperado, ventana temporal estimada. Cada proyección lleva su propio nivel de confianza, y el motor explica siempre el porqué, nunca solo el número — un "72% de probabilidad de crecimiento" sin la evidencia detrás es indistinguible de un número inventado, y este comité no construye motores que aparenten precisión que no tienen.

Condición de activación honesta: el Prediction Engine solo emite una proyección cuando existe suficiente historial real etiquetado para respaldarla estadísticamente. Antes de ese punto, la respuesta correcta es "todavía no hay suficiente historial para predecir esto con responsabilidad" — no un número calculado con una muestra demasiado pequeña para significar nada.

---

## Learning Engine

Inteligencia acumulativa, no reentrenamiento de modelos. El Learning Engine compara sistemáticamente las `Decision` y `Prediction` pasadas contra lo que realmente ocurrió, y recalibra — nunca reescribe de golpe — los pesos que usan Decision, Prediction y Confidence. Fuentes de aprendizaje: predicciones acertadas y fallidas, feedback explícito de usuarios, watchlists y alertas (qué recomendaciones llevaron a acción real), resultados de mercado reales.

Mecanismo de recalibración: ajustes incrementales, acotados (nunca un cambio de pesos que pueda descalibrar el sistema de golpe por un mes de datos ruidosos), siempre versionados para poder revertir si un ajuste empeora las métricas de la Metrics Layer en vez de mejorarlas — el propio Learning Engine se audita contra las métricas de calidad, no se le da fe ciega.

---

## Confidence Engine: siete indicadores, cada uno con su fórmula

Ninguno de los siete es un porcentaje elegido a ojo. Todos se derivan de datos que el sistema ya tiene o ya calcula en otra capa:

**Confidence Score** — el resumen ejecutivo de los seis siguientes: una media ponderada de Coverage, Evidence, Freshness y (cuando existen) Historical/Prediction Reliability, con Uncertainty como su complemento. No es un séptimo cálculo independiente, es la síntesis de los otros seis para que la UI tenga un único número que mostrar primero.

**Coverage Score** — de las fuentes de contexto que el Reasoning Engine podría consultar (nicho conocido, relacionados, perfil de usuario, tendencia de mercado, predicción), qué porcentaje estuvo realmente disponible para esta decisión concreta. `(fuentes disponibles / fuentes posibles) × 100`.

**Evidence Score** — de toda la evidencia reunida por el Evidence Engine, qué proporción es evidencia de respaldo frente al total (respaldo + contradicción), ajustado por volumen: poca evidencia, aunque sea 100% de respaldo, no da un Evidence Score alto — se necesita tanto dirección como cantidad.

**Freshness Score** — cuán reciente es el dato más actual que sustenta la decisión. Función de decaimiento sobre los días transcurridos desde el último snapshot relevante: fresco (0-7 días) puntúa cerca de 100, y decae progresivamente — nunca un corte abrupto, un dato de hace 40 días no es "inútil", es "algo menos fiable que uno de ayer".

**Historical Reliability** — de las decisiones pasadas de este mismo tipo (mismo nicho, categoría o patrón), qué porcentaje se confirmó correcto según los resultados reales reportados. Requiere volumen mínimo de resultados reales para no ser un porcentaje sobre una muestra insignificante — por debajo de ese mínimo, el indicador se omite explícitamente en vez de mostrarse con falsa precisión.

**Prediction Reliability** — específicamente sobre la Prediction Layer: error medio entre lo que se predijo y lo que ocurrió de verdad, medido solo una vez el Prediction Engine deja de estar en modo "sin suficiente historial".

**Uncertainty** — el inverso agregado de Coverage, Evidence Score y Freshness (y de Historical/Prediction Reliability cuando existen): cuanta menos cobertura, evidencia y frescura, mayor incertidumbre. Se calcula siempre, incluso cuando los otros dos indicadores (Historical/Prediction Reliability) todavía no están disponibles — la falta de historial en sí misma es una fuente legítima de incertidumbre, y ocultarla sería menos honesto que mostrarla.

---

## AI Governance

Cuatro compromisos, sin excepción:

**Explicable** — toda `Decision` lleva su justificación en una estructura de datos, no solo en una frase de UI; la explicación se puede regenerar en cualquier idioma o formato sin volver a decidir nada.

**Auditable** — toda decisión queda registrada de forma inmutable: qué entró, qué evidencia se usó, qué argumento ganó, con qué pesos, cuándo. Un registro de solo-añadir (append-only), nunca sobreescribible.

**Reproducible** — dado el mismo estado del Knowledge Graph y los mismos pesos versionados, el mismo input produce el mismo `Decision` determinista. La única pieza no reproducible por naturaleza es la redacción final del LLM en la Communication Layer (por su propia aleatoriedad de generación) — y por eso esa capa nunca decide nada, solo redacta.

**Versionado** — cada cambio de pesos, umbrales o reglas del Decision/Prediction/Confidence Engine queda versionado con fecha y motivo, permitiendo comparar "cómo habría decidido el sistema de hace seis meses sobre este mismo caso" — la prueba definitiva de que el sistema realmente cambia, no solo dice que cambia.

Nunca una caja negra: si en algún punto una pregunta legítima ("¿por qué confiaste tan poco en esto?") no tiene una respuesta rastreable hasta un dato concreto, esa parte del sistema no está lista para producción, por buena que parezca su salida.

---

## AI Quality: métricas, no opiniones

| Métrica | Qué mide | Cómo se calcula |
|---|---|---|
| Prediction Accuracy | Precisión real de la Prediction Layer | Comparar cada `Prediction` pasada contra el resultado real reportado; error medio y % dentro del rango proyectado. |
| Recommendation Accuracy | Si seguir las recomendaciones lleva a buenos resultados | % de recomendaciones aceptadas por el usuario cuyo resultado reportado fue positivo. |
| Confidence Calibration | Si "alta confianza" de verdad acierta más que "baja confianza" | Curva de calibración: agrupar decisiones por nivel de confianza y comparar su tasa de acierto real — deben ser monótonamente crecientes; si no lo son, el Confidence Engine está mal calibrado, no el mercado. |
| Graph Coverage | Cuánto del Knowledge Graph está realmente poblado, no solo creado | % de entidades con atributos clave completos (categoría, relaciones) frente al total de entidades existentes. |
| Knowledge Growth | Ritmo de crecimiento del activo principal | Nuevas entidades y relaciones verificadas añadidas por unidad de tiempo — la métrica que más directamente representa el "activo" del que habla la filosofía de la empresa. |
| Evidence Quality | Cuán bien fundadas están las decisiones | Promedio de piezas de evidencia real por decisión, y % de decisiones con al menos una pieza de evidencia de respaldo (no solo ausencia de contradicción). |
| Discovery Time | Velocidad de detección de oportunidades | Tiempo entre la aparición de una señal de mercado real y el momento en que el sistema la superficia a un usuario relevante. |
| False Positives / False Negatives | Errores de veredicto en cada dirección | Recomendaciones "invertir" que resultaron fracaso (falso positivo) y "evitar" que resultaron éxito (falso negativo), medidas por separado porque tienen costes de negocio distintos. |
| Learning Velocity | Si el sistema mejora con el tiempo, no solo si es bueno hoy | La derivada de las métricas anteriores mes a mes — no el nivel, el cambio de nivel. Es la métrica que hace operativa la pregunta del primer principio: "¿es hoy más inteligente que hace 30 días?". |

Ninguna métrica de esta tabla se calcula a partir de una opinión humana ni de una autoevaluación del LLM — todas se derivan de resultados reales reportados o de comparaciones deterministas entre lo que el sistema dijo y lo que pasó de verdad.

---

## AI Evolution: arquitectura por madurez de datos, no por calendario

Diez años de evolución no se planifican en fechas — se planifican en **umbrales de madurez de datos** que activan capacidades ya diseñadas, nunca en capacidades que se improvisan cuando llega la fecha. Cinco estadios:

**Estadio 0 — Fundacional.** El LLM todavía participa en más pasos de razonamiento de los deseables; Evidence y Decision existen pero con cobertura parcial; Prediction no emite nada por falta de historial. Es honesto y es el punto de partida real.

**Estadio 1 — Razonamiento desacoplado.** Evidence, Reasoning y Decision funcionan de forma completamente determinista sobre el Knowledge Graph; el LLM queda confinado a generación de hipótesis (paso 1 del Reasoning Engine) y a la Communication Layer. Activador: cobertura del grafo (Graph Coverage) por encima de un umbral objetivo, no una fecha.

**Estadio 2 — Predicción activa.** El Prediction Engine empieza a emitir proyecciones reales. Activador: volumen mínimo de resultados reales etiquetados alcanzado.

**Estadio 3 — Aprendizaje continuo.** El Learning Engine recalibra pesos de forma automática y periódica, versionado, con reversión automática si las métricas de calidad empeoran tras un ajuste. Activador: suficiente volumen de resultados Y suficiente historial de Decisions pasadas para medir el efecto de cada recalibración.

**Estadio 4 — Consejo multiagente real.** Más de un agente aporta evidencia genuinamente independiente (no la misma fuente disfrazada de rol distinto). Activador: existencia real de al menos dos fuentes de evidencia independientes entre sí — no una decisión de calendario, una condición estructural.

**Estadio 5 — Simulación.** El Simulation Engine (arquitectura ya preparada, ver más abajo) se activa como capacidad de producto. Activador: decisión de negocio, no de datos — es el único estadio que no está gateado por madurez técnica sino por si se decide ofrecerlo.

Ningún estadio se salta al siguiente sin cumplir su condición — un sistema que activa "aprendizaje continuo" sin suficiente historial no está adelantando el futuro, está fabricando la apariencia de inteligencia sobre una base que no la sostiene, que es exactamente lo que este documento existe para evitar.

---

## Simulation Engine (arquitectura únicamente, no se implementa)

Diseño: las preguntas de "qué ocurriría si..." (sube la competencia, baja la demanda, cambia el CPC, aparece un competidor, cambia el mercado) son perturbaciones controladas sobre las mismas entradas que ya usa la Decision/Prediction Layer en producción — nunca un modelo paralelo con su propia lógica. Una simulación toma el estado actual, aplica un delta hipotético a una o más señales, y hace correr el MISMO pipeline determinista (Evidence → Reasoning → Decision → Prediction) sobre esa realidad alterada. Esto garantiza que una simulación nunca pueda decir algo que el sistema real no diría en esas mismas condiciones — la coherencia entre "lo real" y "lo simulado" es la propiedad de diseño que más vale proteger aquí, y se protege por construcción, reutilizando el motor, no separándolo.

---

## Multiagent Council

Nueve agentes, cada uno definido no por su nombre sino por **una fuente de evidencia genuinamente distinta** — la condición que el comité impone antes de construir ninguno: un consejo donde ocho de nueve miembros leen exactamente el mismo Knowledge Graph no es un consejo, es un LLM con ocho disfraces y ocho veces el coste.

- **Research Agent** — evidencia de fuentes externas amplias (no solo el Graph propio).
- **Trend Agent** — evidencia de señales de tendencia en vivo (búsquedas, redes, marketplaces).
- **Competition Agent** — evidencia sobre competidores reales, no inferida del propio historial de scores.
- **Validation Agent** — no aporta evidencia nueva, contrasta la de los demás agentes contra el Knowledge Graph (es, en esencia, un consumidor del Evidence Engine puesto al servicio del consejo).
- **Risk Agent** — evidencia centrada específicamente en señales de riesgo (volatilidad histórica, saturación, dependencia de un solo canal).
- **Market Agent** — evidencia agregada de mercado/categoría/país, no de un nicho individual.
- **Prediction Agent** — la interfaz del Prediction Engine hacia el consejo.
- **Evidence Agent** — el Evidence Engine mismo, aportando el paquete estructurado base sobre el que razonan los demás.
- **Chief Intelligence Agent** — no es un agente más, es la Decision Layer formalizada como receptor de los ocho informes: resuelve conflictos, pondera, decide. Llamarlo "agente" es una conveniencia de lenguaje, no una capa nueva — evita que el consejo necesite un décimo componente para tomar la decisión final.

**Comunicación**: cada agente emite el mismo `StructuredArgument` que usa la Reasoning Layer en solitario — un formato común es lo que permite que el Chief Intelligence Agent los compare sin lógica especial por agente.

**Conflictos**: se muestran, nunca se disuelven en un consenso artificial. Si el Trend Agent y el Risk Agent llegan a lecturas opuestas con evidencia igual de sólida, la Decision Layer lo dice explícitamente en vez de promediar dos verdades incompatibles en un número que no representa a ninguna.

**Priorización**: no todos los agentes pesan igual en todas las decisiones — el Market Agent pesa más en una pregunta de "qué mercado elegir", el Risk Agent pesa más en una pregunta de "cuánto invertir ahora". La ponderación por tipo de pregunta es responsabilidad de la Decision Layer, no de los agentes entre sí.

---

## Roadmap

| # | Tarea | Objetivo | Beneficio | Impacto | Riesgo | Complejidad | Dependencias | Tiempo estimado |
|---|---|---|---|---|---|---|---|---|
| **P0.1** | Formalizar límites Evidence/Reasoning/Decision como contratos explícitos | Que cada capa tenga entrada/salida tipada y verificable | Elimina ambigüedad sobre quién decide qué | Alto | Muy bajo | Baja | Ninguna | 1-2 semanas |
| **P0.2** | Confidence Engine completo (7 indicadores) | Confianza matemática, no inventada | Base de todo lo demás — sin esto, "explicable" es solo una palabra | Alto | Muy bajo | Media | Historial mínimo para Freshness/Uncertainty (ya disponible) | 1-2 semanas |
| **P0.3** | Governance: registro de auditoría por decisión | Trazabilidad real de cada veredicto | Prerrequisito de "nunca caja negra" | Alto | Bajo | Baja | Ninguna | 1 semana |
| **P0.4** | Metrics Layer: instrumentar las 9 métricas de AI Quality | Medir mejora real, no percibida | Convierte el primer principio en algo verificable | Muy alto | Bajo | Media | Volumen mínimo de resultados reales para algunas métricas | 2-3 semanas |
| P1.1 | Communication Layer como frontera explícita frente al resto | Facilitar sustituir de proveedor de LLM sin tocar el resto del sistema | Alto a largo plazo | Bajo | Media | P0.1 | 2-3 semanas |
| P1.2 | Recommendation Layer separada de Decision | Personalización real sin contaminar el veredicto objetivo | Medio-alto | Bajo | Media | User Memory con volumen suficiente | 2-3 semanas |
| P1.3 | Learning Engine: recalibración versionada de pesos | Que el sistema mejore solo, de forma medible | Muy alto | Medio (puede descalibrar si se hace mal) | Alta | Volumen de resultados + Metrics Layer activa | 4-6 semanas |
| P2.1 | Prediction Engine: activación real | Proyecciones reales, no solo el contrato | Muy alto | Medio | Alta | Umbral de resultados etiquetados alcanzado | 6-8 semanas |
| P2.2 | Historical/Prediction Reliability del Confidence Engine | Completar los 2 indicadores que hoy dependen de volumen | Alto | Bajo | Baja (una vez hay datos) | P2.1 | 1-2 semanas |
| P3.1 | Multiagent Council: primeros 2-3 agentes con fuente de evidencia realmente distinta | Empezar el consejo sin fingir independencia que no existe | Medio hoy, alto a futuro | Alto si se adelanta sin fuentes distintas | Alta | Fuentes de evidencia externas genuinamente nuevas | 8-12 semanas |
| P3.2 | Simulation Engine: implementación | Escenarios hipotéticos sobre el motor real | Medio | Bajo | Media | Decision/Prediction estables y en producción | 3-4 semanas |
| P3.3 | Resto del Multiagent Council (6 agentes restantes) | Consejo completo | Medio | Alto si se hace antes de tener fuentes distintas para cada uno | Alta | Cada fuente de evidencia debe justificarse por separado | Variable, por agente |

---

## Auditoría crítica final

Un comité que diseña doce capas, siete indicadores de confianza y nueve agentes sin después cuestionarse a sí mismo ha construido un catálogo, no una arquitectura. Esta es esa revisión, con la misma dureza que se le pediría a cualquier propuesta externa.

**Lo que se queda tal cual**: las 12 capas superan la prueba de admisión que se definió al principio — cada una tiene una entrada, una salida y una responsabilidad que ninguna otra capa cubre. El Confidence Engine como biblioteca compartida (no capa 13) es la decisión correcta — convertirlo en un paso secuencial habría sido exactamente el tipo de "módulo por moda" que este documento prohíbe.

**Lo que se vigila con más dureza**: la separación entre Decision Layer y Recommendation Layer es la más frágil de las doce. Si en la práctica la personalización del usuario resulta ser una señal débil (poca varianza real entre lo que distintos usuarios deberían hacer ante el mismo veredicto), estas dos capas deben fusionarse sin nostalgia — mantener una capa separada sin una señal real que justifique la separación es exactamente la clase de complejidad innecesaria que el primer principio prohíbe.

**Lo que se recorta explícitamente de la ambición original del prompt**: el Consejo Multiagente de nueve miembros NO se construye completo. Solo se construyen los agentes que tengan una fuente de evidencia genuinamente distinta del Knowledge Graph — hoy eso son, como mucho, dos o tres (Trend, Competition, Research, si de verdad consultan señales externas independientes). Los otros seis se quedan como contratos, no como servicios en producción, hasta que cada uno tenga su propia fuente real. Construir los nueve ahora sería nueve veces el coste y la latencia por una ilusión de independencia que no existe todavía — el propio principio rector de este documento lo prohíbe.

**Lo que se descarta por completo**: una base de datos de grafos dedicada (el modelo relacional aguanta la década); un "Módulo de Auditoría" como capa del pipeline en vez de transversal (crearía el incentivo equivocado de saltárselo bajo presión); cualquier indicador de confianza calculado por autoevaluación del LLM (todos los siete del Confidence Engine se derivan de datos verificables, nunca de que el modelo diga "estoy seguro").

**La pregunta que sobrevive a toda la auditoría**: de las doce capas, los siete indicadores y los nueve agentes, ¿cuál es el único activo que sigue teniendo valor si se elimina todo lo demás? La respuesta no cambia respecto al principio con el que empieza este documento — es el Knowledge Graph, con su historial verificado de decisiones y resultados reales. Todo lo demás en este blueprint —las capas, los motores, el consejo— existe para alimentarlo, protegerlo y demostrar, con métricas y no con opiniones, que crece más inteligente cada mes. Esa es la empresa que este comité está diseñando: no la que mejor usa un modelo de lenguaje este año, sino la que más difícil es de replicar dentro de diez.

---

## Addendum: contraste contra el código real (primer paso de adaptación)

El documento de arriba se escribió deliberadamente sin mirar la implementación actual. Este addendum sí la mira — es el primer paso de "después ya adaptaremos el código existente" que quedó pendiente al cierre del blueprint. Mapea cada capa contra lo que ya existe en el repositorio, y marca qué se implementó ya en esta misma sesión como parte de este contraste.

| Capa del blueprint | Módulo real hoy | Estado |
|---|---|---|
| 1. Data Layer | `niche_score_history`, `user_niche_interactions`, `niche_outcomes` (migraciones 001-011) | Alineado — captura cruda ya normalizada, sin interpretación. |
| 2. Knowledge Layer | `lib/services/nicheGraph.ts` + tabla `niches` | Alineado — el grafo relacional ya existe; `category` sigue sin poblarse (gap conocido, P1). |
| 3. Memory Layer | `lib/services/marketMemory.ts` (Market) + `lib/services/userProfile.ts` (User) | Alineado — ambas son agregaciones puras sobre el Graph, sin duplicar datos, exactamente como diseña el blueprint. |
| 4. Evidence Layer | `lib/services/engine/reasoningLayer.ts` (`buildContext`, `buildExplanation`) | Alineado — produce el paquete de usedSources/missingSources; contradicciones/evidencia de respaldo viven en la capa 6, no aquí (ver más abajo). |
| 5. Reasoning Layer | `reasoningLayer.ts` + el propio LLM en `lib/ai.ts::buildSystem` | Parcial — el LLM sigue generando hipótesis Y veredicto en el mismo paso; el blueprint pide que solo genere hipótesis (paso 1 del Reasoning Engine) y que el veredicto salga exclusivamente de la Decision Layer. Este es el gap más importante que queda abierto — no se cierra en esta sesión. |
| 6. Decision Layer | `lib/services/engine/decisionEngine.ts` (`decide`, `detectContradictions`, `computeSupportingEvidence`) | Alineado — ya es el único punto de decisión, ya pondera evidencia, ya calcula confianza, ya justifica. Construido en la sesión anterior, antes de este blueprint, y encaja sin cambios. |
| 7. Prediction Layer | `lib/services/engine/predictionEngine.ts` | Alineado en contrato — `isReady()`/`predict()` ya devuelven honestamente "sin datos" hasta el umbral; sin implementación real todavía, tal como diseña el Estadio 2 de AI Evolution. |
| 8. Recommendation Layer | No existe separada — el veredicto en sí ya cumple ese papel hoy | Sin construir a propósito — la auditoría final del blueprint pide vigilar esta capa antes de separarla; no hay todavía señal de personalización lo bastante fuerte para justificar el coste de separarla de Decision. |
| 9. Communication Layer | `contextToPromptBlock()` + el bloque de explicabilidad en `app/dashboard/page.tsx` | Alineado — ya es la única frontera que toca directamente al LLM/UI. |
| 10. Learning Layer | No existe | Sin construir — gateado por volumen de `niche_outcomes` (mismo umbral que Prediction Layer), tal como ya establecía `ARQUITECTURA_INTELIGENCIA_10_ANOS.md`. |
| 11. Governance Layer | `decisionEngine.ts::decide()` (log estructurado por decisión) | Parcial — logging real ya existe; registro persistente y consultable sigue siendo P1 (requiere migración, requiere tu confirmación). |
| 12. Metrics Layer | `lib/services/engine/metrics.ts` (**nuevo, añadido en este contraste**) | Parcial, honesto — Graph Coverage y Knowledge Growth ya se calculan de verdad y se muestran en `/admin/motor-propio`; las otras 7 métricas del blueprint quedan documentadas con su condición de activación, no aproximadas. |

**Lo que se implementó en este paso** (aditivo, cero riesgo, sin páginas nuevas — extiende el panel interno ya existente):
- `lib/services/engine/metrics.ts`: `computeGraphCoverage()` y `computeKnowledgeGrowth()`, las únicas 2 de las 9 métricas de AI Quality calculables hoy sin inventar nada.
- `/api/admin/motor-propio-stats` y `/admin/motor-propio`: nueva sección "Metrics Layer" con esos dos indicadores, junto a una nota explícita de por qué "con categoría" es bajo hoy.
- `registry.ts`: Módulo 18 (Metrics Layer) añadido al punto único de acceso al motor.

**Lo que queda como el gap más importante, sin tocar todavía**: la capa 5 (Reasoning). Hoy el LLM sigue generando hipótesis y veredicto en la misma llamada — separar "generar hipótesis" de "decidir" de verdad exigiría rediseñar el prompt de `buildSystem` en `lib/ai.ts`, que es la pieza más frágil y central de todo el sistema (con su propio parser de reparación de JSON). No se toca sin que lo autorices explícitamente, dado el riesgo de romper el contrato JSON que sostiene toda la app.
