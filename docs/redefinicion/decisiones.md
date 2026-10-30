# Redefinición del CRM SEPA — Decisiones

Registro de las reglas acordadas durante la revisión del sistema (fpc-front + fpc-backend).
Este documento reemplaza como fuente de verdad a specs, auditorías y observaciones previas.
Cuando una regla aquí contradiga el código o un doc viejo, manda esta.

- Inicio: 2026-10-27
- Estado: **en definición** — no se modifica código hasta cerrar todo.

---

## 0. Principios rectores

- **P-0.1 El recorrido del paciente es el núcleo (≈90 % del CRM).** Enrolamiento → seguimientos →
  diagnóstico/tratamiento → ruta de atención debe funcionar completo. El resto es complementario.
- **P-0.2 Orientado a indicadores.** Casi todo lo que cubre el sistema debe poder medirse.
  - **I1** Se guardan fechas reales de cada hito (cita, resultado, informado al paciente, inicio/fin
    de tratamiento, abandono). En cargas tardías se guarda la fecha del hecho, no la del registro.
  - **I2** Historial, no solo estado actual: cada cambio de fase, subcategoría, estado diagnóstico o
    de tratamiento es un evento con fecha.
  - **I3** Atribución: distinguir lo que logró SEPA de lo que el paciente traía.
  - **I4** Todo dato que alimenta un indicador sale de catálogo/enum. Texto libre solo complementa.
  - **I5** Cada regla nueva responde qué indicador alimenta; cada indicador debe tener campos que lo soporten.
- **P-0.3 Documentación.** La documentación principal es el código. Además, un documento corto por
  dominio con reglas claras. Los docs viejos (`specs/`, auditorías, observaciones) pasan a archivo histórico.

## 1. Roles

`ADMIN`, `FOUNDATION`, `AGENT`, `VOLUNTEER` (los existentes). Permisos detallados: pendiente de
extraer del código y validar.

## 2. Enrolamiento

- **E1** Se guarda solo completo (todos los pasos). No hay enrolamientos parciales en el sistema.
- **E2** El borrador persiste en el navegador (localStorage) para retomarlo si se cierra o corta la llamada.
- **E3** El enrolamiento es el primer seguimiento del paciente.
- **E4** Fase de salud: diagnóstico de cáncer o signos y síntomas. La subcategoría se autocompleta
  (signos y síntomas → su subcategoría; cáncer → derivada de los tratamientos ingresados, normalmente
  tratamiento activo) y puede actualizarse después. Lista completa de subcategorías: la del modal
  de `/pacientes`.
- **E5** Si un paciente existente vuelve a llamar → es un seguimiento, no un nuevo enrolamiento.
- **E6** Si el paciente estaba dado de baja o con cáncer descartado → se reactiva y sus datos se
  actualizan con los nuevos (los anteriores quedan en el historial por campo).
- **Pendiente:** definir datos obligatorios del enrolamiento.
- **E-R (2026-10-28) Reenrolamiento.** Un paciente **inactivo** vuelve al programa con un seguimiento
  de propósito `REENROLLMENT`, no repitiendo el enrolamiento. El seguimiento pide motivo (catálogo
  `reenrollment_reason`), canal de ingreso (`entry_source`/`entry_sub_source`), situación de salud
  (fase y subcategoría) y la confirmación de que se revisaron teléfono, dirección, seguro y contacto
  principal (se corrigen con sus pantallas de siempre). Al registrarlo
  (`POST /follow-ups/:id/reenrollment`) se actualiza la fase, se reactiva al paciente ligado al
  seguimiento y este queda realizado. Los pacientes con cáncer descartado no se reenrolan: siguen con
  sus seguimientos. Es el **único** camino para reactivar: se quitó `PATCH /patients/:id/reactivate`, y
  ni el wizard ni la carga histórica reenrolan (enrolar a un paciente ya enrolado responde 409); si el
  DNI es de un inactivo, el wizard lleva a este seguimiento. En indicadores se cuenta aparte (`reenrolledInPeriod`, grupo
  abandono); "enrolados" sigue siendo el primer enrolamiento.

## 3. Acompañantes

- **A1** Entidad propia (no paciente con flag), relacionada con uno o varios pacientes, con parentesco
  (familiares y amigos). Un acompañante puede convertirse en paciente ("enrolar desde este contacto").
  - **Implementado (2026-10-28).** Tabla `companions` (migración `1784930000000`): los `patients` con
    rol COMPANION pasan con su mismo UUID y el rol desaparece. `companion_patient`, `enrollments` y
    `psychooncology_appointments` apuntan a `companions`. El seguimiento guarda
    `interlocutor_companion_id` (null = se habló con el paciente); la API mantiene `interlocutorId`
    = acompañante o el propio paciente. La migración se detiene si algún acompañante tiene datos
    clínicos, y no tiene vuelta atrás (respaldo).
  - Parentesco = catálogo `companion_relationship` (abierto a agentes). Los códigos del front se
    conservan y cada texto libre distinto se agregó al catálogo.
  - Solo se ve y edita desde la ficha del paciente: `PATCH /patients/:id/companions/:companionId/person`
    (datos personales; aplica a todos los pacientes que acompaña). Documento único entre acompañantes.
  - "Enrolar desde este contacto": `POST /patients/:id/companions/:companionId/convert-to-patient`
    crea un prospecto con sus datos (`companions.converted_patient_id`); se enrola con el wizard.

## 4. Seguimientos

- **S1** Todo contacto con el paciente, por cualquier canal (llamada, WhatsApp, etc.), es un seguimiento.
- **S2** Trazabilidad por campo: cada cambio guarda valor anterior, valor nuevo, autor, fecha y seguimiento.
- **S3** Cambios hechos fuera de un seguimiento (desde la ficha) quedan como "ajuste administrativo" con autor.
- **S4** Editan un seguimiento: quien lo hizo, admins y fundación. Sin plazo. Las ediciones quedan en historial.
- **S5** Un seguimiento tiene uno o más **intentos** (canal + resultado). "No contestó" es un intento
  válido. Indicador: seguimientos con primer intento fallido y contacto logrado después.
- **S6** Estados distintos: **vencido** (el sistema lo marca al pasar el día agendado sin realizarse) y
  **cancelado** (decisión del agente). Ambos pueden reagendarse. Se guarda el historial de estados.
- **S7** Agendar el siguiente seguimiento es opcional, pero el sistema lo facilita (es lo habitual).
- **S8** El seguimiento se asigna al agente que lo crea. Si lo crea fundación, debe elegir agente.
- **S9** Un seguimiento puede nacer por WhatsApp (el paciente escribe).
- Durante seguimientos se agregan datos nuevos (diagnósticos, tratamientos) y otros que el enrolamiento
  no pregunta (comorbilidades, afiliaciones). En signos y síntomas se sigue la cita hasta diagnóstico
  o "cáncer descartado".

## 5. Recordatorios

- **R1** Solo informan. No son seguimientos; la respuesta del paciente no los convierte en uno.
- **R2** WhatsApp automático y n8n en pausa. Todo recordatorio tiene botón **copiar** para envío manual.
- **R3** Envío por correo con **Resend** si el paciente tiene correo (en alcance actual).
- **R4** Toda cita médica futura lleva recordatorio, creado por el sistema al registrar la cita. El agente
  elige cuándo: 2 h antes, 1 día antes o fecha/hora manual. Citas pasadas informadas pueden no tenerlo.

## 6. Psicooncología y voluntarios

- **V1** El voluntario solo participa en psicooncología.
- **V2** Ve la ficha de salud completa, solo de sus pacientes asignados (incluidas sesiones previas con
  otros voluntarios).
- **V3** Resuelve sus sesiones: llena campos y marca realizada / no se presentó.
- **V4** Disponibilidad en bloques de 1 h, recurrentes con fecha fin o sueltos.
- **P1** La sesión es entidad propia; si se agendó desde un seguimiento, queda vinculada.
  Normalmente la derivación nace de un seguimiento.
- **P2** Agenda un agente o fundación, solo sobre un bloque libre; el bloque queda ocupado.
- **P3** Estados: programada, realizada, no se presentó, cancelada, reprogramada, vencida. Con historial.
- **P4** Ciclo base de 4 sesiones; si el voluntario considera que hacen falta más, se lo indica a un
  agente y este las agenda.
- **P5** Virtual: llamada o videollamada. Link de Zoom al crear o editando después.
- **P6** Recordatorio propio de la sesión (no un recordatorio aparte), para el paciente: automático
  (2 h / 1 día / manual) o copiar. Sin link de Zoom en videollamada no se puede enviar.
- **P7** Editan una sesión: el voluntario que la hizo, admins y fundación, con historial.
- **P8** Los agentes tienen una lista de sesiones estilo `/agenda`.
- **P9** No se puede borrar un bloque ocupado. Si un voluntario se da de baja, sus sesiones futuras
  quedan por reasignar y se genera alerta.
- **P10** El paciente puede pedir otro horario; si su voluntario no tiene disponibilidad, se reasigna
  a otro voluntario.
- **P11** El voluntario no edita datos del paciente: solo lee y edita sus sesiones.
- **P13** Cierre del ciclo con fecha y motivo (completó / abandonó / no lo necesita). Lo registra el
  agente. El abandono lo marca el agente (sin automatismos).

## 7. Hospitales y ruta de atención

- **H1** El hospital guarda nivel de atención con categoría oficial MINSA (I-1…III-E, agrupado en
  nivel I/II/III), institución (MINSA, EsSalud, FFAA/PNP, privado) y ubicación (ubigeo).
- **H2** Entidad **Derivación**: origen, destino, motivo, fechas (solicitud, emisión, atención),
  estado (solicitada/emitida/atendida/rechazada/vencida), si SEPA intervino, seguimiento de registro.
  Tipos: formal o por cuenta propia. Reemplaza los booleanos `hasReferral` dispersos.
- **H3** Si hay hoja de referencia, se puede adjuntar y queda en los documentos del paciente.
- **H4** Se registra la ruta completa, incluidos establecimientos de nivel I.
- **Pendiente:** fuente para precargar establecimientos (CENEPRED local o RENIPRESS/SUSALUD).

## 8. Catálogos

- **C1** Todo dato medible sale de catálogo. No hay "Otro" con texto libre; si falta, se agrega al catálogo.
- **C2** Agentes editan los catálogos abiertos (los usados en formularios). Fundación y admin, todos.
- **C3** Admin puede fusionar ítems duplicados: se reapuntan las referencias, se registra la fusión y
  el duplicado se desactiva (no se borra).

## 9. Charlas de prevención

- **CH1** Catálogo de charlas (solo nombre, sin fecha ni lugar). Se registra qué **acompañantes**
  están interesados. No se registra asistencia.
  - **Implementado (2026-10-28).** Catálogo `educational_talk` (lo editan fundación y admin) y tabla
    `companion_talk_interests` (acompañante, charla, paciente desde el que se registró, seguimiento,
    autor; un interés por acompañante y charla). Reemplaza `enrollment_family_talk_interests`: cada
    familiar se emparejó por nombre con un acompañante del paciente o se creó y vinculó; cada nombre de
    charla pasó al catálogo. El enrolamiento sigue recibiendo `familyPreventionTalkInterests` con
    nombre/teléfono/correo del familiar y `talk` (código o nombre del catálogo) y aplica la misma regla.
  - Endpoints: `GET /talk-interests` (filtros charla y nombre), `GET /patients/:id/talk-interests`,
    `POST /patients/:id/companions/:companionId/talk-interests`,
    `DELETE /patients/:id/talk-interests/:interestId`. Se quitó `GET /family-talk-interests`.

## 10. Alertas

- **AL1** El agente crea la alerta desde un seguimiento: hospital, categoría (catálogo, sin "Otro"),
  severidad, descripción.
- **AL2** La alerta es del hospital; otros pacientes que reportan lo mismo se vinculan a la alerta
  existente con su seguimiento.
- **AL3** Estados: reportada → en revisión → resuelta, con historial (fecha y autor).
- **AL4** Solo fundación resuelve, registrando el procedimiento en notas.
- **AL5** Puede derivarse a una entidad externa (catálogo) con nota. Poco frecuente.
- **AL6** Al crearse, se envía correo (Resend) a la fundación y sus usuarios.
- **AL7** Aviso a pacientes con **tratamiento activo** en ese hospital: por correo (Resend) y con
  lista de afectados + texto para copiar.
- **AL8** Se mantiene el resumen con IA en la alerta.
- **AL9** Limpieza: eliminar columna duplicada de "resuelto por" y la categoría `OTHER`.

## 11. Call center

- **CC1** Pantalla para fundación y admin: agentes y sus pendientes (seguimientos programados y recordatorios).
- **CC2** Permite reasignar seguimientos entre agentes, con registro.
- **CC3** Muestra la carga por agente: hoy, semana y vencidos.

## 12. Dashboard

- **D1** Cada indicador tiene definición documentada (fórmula, fuente, campos).
- **D2** Lo ven fundación y admin.
- **D3** Filtros: fecha, rango de fechas, departamento, hospital, agente, fase, subcategoría y todo
  filtro significativo. Todos los indicadores responden a los mismos filtros.
- **D4** Se mantienen los indicadores actuales; se valida la fórmula de cada uno.
- **Pendiente:** lista de indicadores del usuario → matriz indicador / fórmula / campos / existe hoy / brecha.

## 13. Exportación

- **X1** Exportación a Excel ordenada: una hoja por entidad (pacientes, acompañantes, seguimientos e
  intentos, diagnósticos, tratamientos, derivaciones, citas, sesiones, recordatorios, alertas,
  historial de cambios), con ID y documento del paciente en cada hoja, etiquetas legibles y fechas locales.
- **X2** Solo fundación y admin. Con filtros (los mismos del dashboard). Cada exportación se registra
  (quién, cuándo, filtros).

## 14. Carga histórica

- **CH-1** Modo temporal con permisos extra para que los agentes pasen pacientes antiguos desde Excel
  (291 a la fecha).
- **CH-2** Se guarda la fecha real del hecho, no la de la carga.
- **CH-3** Sin fecha de fin; se pausará cuando terminen y los permisos extra dejan de aplicar.
- **CH-4** Los pacientes cargados llevan un flag de carga histórica. **No** se excluyen de los indicadores.

## 15. Fundación

- **F1** Una sola fundación. Los voluntarios ven sus contactos. Es una página de configuración simple.

## 16. Inteligencia artificial

- **IA1** Resumen del paciente: se mantiene igual.
- **IA2** Asistente de datos (chat) para fundación y admin: preguntas sobre indicadores, pacientes,
  alertas. Agente con **tool calls** de solo lectura que reutilizan los servicios del dashboard/export
  y respetan permisos (no SQL libre). Responde citando de qué datos sale; cada pregunta se registra.
  Regla de diseño: toda capacidad nueva de la API debe poder exponerse como herramienta.
- **IA4** Los datos del paciente se seudonimizan antes de enviarse al modelo; el sistema rehidrata
  nombres al mostrar.
- **IA5** Solo fundación y admin usan el asistente de datos.
- **IA3** Asistente de consulta (RAG) para agentes: panel lateral ocultable (como notas) en
  enrolamiento y seguimientos. Responde solo con el material de la fundación, citando fuente; si no
  está en el material, lo dice. No recibe datos del paciente. Las preguntas sin respuesta se registran.
- **IA6** Material en PDF y Word, cargado y actualizado por fundación desde el sistema. Volumen
  desconocido: la indexación debe escalar.
- **IA7** Solo da información al agente; no redacta respuestas para el paciente.

### Implementado: asistente de datos (IA2, IA4, IA5) — 2026-10-28
- Módulo `src/modules/assistant/`. Endpoints (solo ADMIN y FOUNDATION, 15 preguntas/min):
  `POST /assistant/messages` (`{ message, conversationId? }`), `GET /assistant/conversations`,
  `GET /assistant/conversations/:id`, `DELETE /assistant/conversations/:id`.
- Bucle de Gemini con function calling, máximo 8 pasos. Las herramientas son de solo lectura y
  validan sus argumentos con los DTO de la API: `get_indicators` (los 7 grupos del dashboard),
  `search_health_centers`, `search_patients`, `list_alerts` y `get_call_center_workload`. Cada
  herramienta declara sus roles. Herramienta nueva = una entrada más en `assistant-tools.service.ts`.
- IA4: los pacientes viajan al modelo como `P-001…`. El mapa vive en
  `assistant_conversations.pseudonyms`; la API rehidrata el nombre y devuelve `patients`
  (token, id, nombre) para enlazar a la ficha. Lo que el usuario escribe en la pregunta sí llega al
  modelo tal cual.
- Registro: `assistant_messages` guarda pregunta, respuesta (con seudónimos), herramientas usadas
  con sus argumentos y resultado, modelo y tokens. La respuesta trae `sources` para citarlas.
- Modelos: `GEMINI_ASSISTANT_MODELS` (lista en orden; default
  `gemini-3-flash-preview,gemini-2.5-flash`). Ante 429/5xx reintenta y pasa al siguiente.
- Front implementado: panel global con modos Datos del CRM y Documentos. Streaming queda pendiente.
- Consultas ampliadas: filtros combinables de pacientes por datos personales,
  residencia, situación clínica, seguros, tratamientos, acompañantes, fechas y
  pendientes; catálogo de códigos reales; detalle paginado de tareas por paciente
  seudonimizado en `get_call_center_workload`. Véase `asistente-datos.md`.

### Implementado: consulta documental (IA3, IA6, IA7) — 2026-10-29

- Modo `DOCUMENTS` en el mismo asistente, disponible para agentes, administración y fundación.
- Biblioteca de PDF y Word `.docx`, administrada por ADMIN/FOUNDATION, con borradores, preparación, publicación, retirada y eliminación.
- File Search de Gemini con filtros de documentos publicados, citas verificadas por metadatos, extractos y página cuando existe. Sin herramientas de datos del CRM en este modo.
- Registro de preguntas sin respaldo y conservación de citas históricas. La ficha del paciente no se incorpora automáticamente.
- Detalles, endpoints y despliegue en `asistente-documental.md`.

## 17. Hallazgos del código (para la auditoría)

- `health-center.category` es texto libre opcional; no hay nivel de atención normalizado.
- No existe entidad de derivación; hay `hasReferral` en síntomas, diagnóstico y citas
  (`hasReferralSheet`) y `isSepaActiveReferral` en diagnóstico.
- Charlas cuelgan del enrolamiento con nombre de charla y familiar en texto libre.
- Alertas: dos columnas de resolutor (`resolved_by_id`, `resolved_by_user_id`), categoría `OTHER`,
  estados solo ACTIVE/RESOLVED.

## 17b. Matriz de indicadores

Fuente: "Observaciones CRM" p. 23–46 (punto 19). Contrastado con
`modules/dashboard/dashboard-indicators.service.ts` y las entidades (2026-10-27).
Estado: ✅ calculado hoy · 🟡 parcial / dato existe pero frágil · ❌ no existe.
Revisión de fórmula (D4) pendiente para todos los ✅.

### a. Demográficos (cohorte enrolada en el periodo)
| # | Indicador | Campos | Estado |
|---|---|---|---|
| a1 | Edad | `patient.birth_date` | ✅ |
| a2 | Sexo | `patient.gender` | ✅ |
| a3–5 | Distrito / provincia / departamento de residencia actual | `patient_address` | ✅ |
| a6 | Zonificación urbana/rural (residencia actual) | `details.zone_type` | ✅ |
| a7 | Grado instructivo | `details.education_level` | ✅ |
| a8 | Lengua originaria | `details.native_language` | ✅ |
| a9 | Tipo de seguro (cambia en seguimientos) | `patient_insurance` vigente | ✅ (¿vigente o al enrolar? definir) |
| a10 | Estatus laboral | `details.is_working` | ✅ |

### b. Epidemiológicos
| # | Indicador | Campos | Estado |
|---|---|---|---|
| b1 | Mortalidad | `patient.deceased_at` | ✅ |
| b2 | Morbilidad (tipo de cáncer) | `patient_diagnosis` vigente | ✅ |
| b3 | Tipo de cáncer por región actual | diagnóstico × departamento | 🟡 cruce no expuesto como tal |
| b4 | Casos por estadio y tipo | `cancer_stage` × diagnóstico | 🟡 distribuciones separadas, falta cruce |
| b5 | Pacientes en remisión | `treatment_situation = REMISSION` | ✅ (vía distribución) |
| b6 | Paliativo temprano/simultáneo | `treatment_type` | ✅ (vía distribución) |
| b7–11 | Tratamiento en espera / en búsqueda / en proceso / culminado / suspendido | `treatment_situation` | 🟡 enum mezcla ES/EN y no calza 1:1 con las etiquetas del cliente |

### c. Satisfacción
| # | Indicador | Campos | Estado |
|---|---|---|---|
| c1 | Satisfacción llamada de enrolamiento (1–5) | `enrollment.survey_accepted`, `follow_up_quality_rating` | 🟡 dato existe, no está en dashboard |
| c2 | Satisfacción general a los 3 meses del enrolamiento | — | ❌ |
| c3 | Satisfacción talleres/charlas | — (form externo) | ❌ |
| c4 | Satisfacción psicooncología (1–5 + comentario) | `psychooncology_appointment.satisfaction_rating/comment` | 🟡 no está en dashboard |

### d. Gestión / proceso (atribución SEPA)
| # | Indicador | Campos | Estado |
|---|---|---|---|
| d1 | Afiliados al SIS por soporte SEPA | `patient_sis_affiliation.affiliated_via_sepa` **y** `patient_insurance.affiliated_via_sepa` | 🟡 dos fuentes |
| d2 | Activación EsSalud por SEPA | `patient_insurance.affiliated_via_sepa` | ✅ |
| d3 | Primera consulta en atención primaria por SEPA | `symptom_report.attended_primary_care_via_sepa` | ✅ |
| d4 | Referidos a mayor complejidad por SEPA (signos y síntomas) | `referred_via_sepa` en síntomas y citas | 🟡 → entidad Derivación (H2) |
| d5 | Atendidos por especialidad para diagnóstico | `diagnosis_specialty` | ✅ |
| d6 | Cáncer descartado por SEPA | eventos de estado diagnóstico | ✅ |
| d7 | Diagnosticados con cáncer por SEPA | eventos de estado diagnóstico | ✅ |
| d8 | Acceden a tratamiento por SEPA | `treatment.treatment_via_sepa` | ✅ |
| d9 | Beneficio de traslado por SEPA (+ proveedor) | `details.transportation_*` | ✅ (con "Otro" libre → C1) |
| d10 | Albergue por SEPA (+ proveedor) | `details.shelter_*` | ✅ (con "Otro" libre → C1) |

### e. Productividad
| # | Indicador | Campos | Estado |
|---|---|---|---|
| e1 | Días enrolamiento → afiliación SIS | `enrolled_on`, `affiliated_at` | ✅ |
| e2 | Días 1ª consulta atención primaria → diagnóstico | `first_primary_care_via_sepa_at`, `diagnosis_date` | ✅ |
| e3 | Días diagnóstico → primer tratamiento | `diagnosis_date`, `treatment.start_date` | ✅ |
| e4 | Pacientes activos | `patient.activity_status` | ✅ |
| e5 | Uso de cada beneficio (acompañamiento, psicooncología, charlas) | varios; charlas = `details.attended_educational_talk` | 🟡 charlas choca con CH1 |
| e6 | Usaron los tres beneficios | idem | 🟡 |

### f. Adherencia al tratamiento
| # | Indicador | Campos | Estado |
|---|---|---|---|
| f1 | Cumplimiento de esquema (quimio/radio): sesiones realizadas / programadas ×100 | `completed_sessions`, `scheduled_sessions` | ✅ |
| f2 | Cumplimiento de tratamiento hormonal | `hormonal_treatment_completed` | ✅ |
| f3 | Barreras para iniciar tratamiento (% enrolados) y orientados ante barreras | `access_barrier_code`, `oriented_regarding_barriers` | ✅ (`OTHER` → C1) |
| f4 | Abandono de tratamiento/citas por barreras (+ motivo) | `treatment_abandonment_reason` | 🟡 solo total con barreras, sin desglose por motivo |
| f5 | Interrupción por criterio clínico (reacción adversa) | `interruption_reason` | ✅ (`OTHER` → C1) |
| f5b | Paliativo sin tratamiento activo | `treatment_type` | ✅ |

### g. Abandono del programa (≠ abandono de tratamiento)
| # | Indicador | Campos | Estado |
|---|---|---|---|
| g1 | Abandono por motivo (voluntario, no ubicable, fallecido, otro) | `details.program_dropout_reason_code` **y** `patient.deactivation_reason` | 🟡 dos fuentes con enums distintos |

### Brechas transversales
- **Filtros (D3):** el endpoint solo filtra por periodo/rango y departamento. Faltan hospital, agente, fase, subcategoría.
- **Fuentes duplicadas:** afiliación SEPA (2), abandono/baja (2), derivación (3+). Unificar antes de validar fórmulas.
- **"Otro" con texto libre** en traslado, albergue, barreras, interrupción, abandono, especialidad, tratamiento → C1.
- **Satisfacción** no tiene modelo de encuestas.

### Decisiones sobre la matriz (2026-10-27)
- **CH2** Además del interés de acompañantes (CH1), se registra la **asistencia** a charlas (alimenta
  e5/e6). Probablemente provenga de otro sistema: el modelo debe admitir carga/importación externa.
- **P14** Las sesiones de psicooncología pueden ser para el paciente o para un **acompañante/cuidador**
  (`beneficiary_type`). La sesión siempre cuelga del paciente y opcionalmente del acompañante beneficiario.
- **P15** Inasistencia a una sesión: **no** se crea un seguimiento automático. Se muestra un aviso en
  el panel del paciente mientras tenga una sesión no atendida sin gestionar.
- **EN1** Entidad **Encuesta**: tipo (enrolamiento, 3 meses, psicooncología, charla), calificación 1–5,
  comentario, fecha, canal. Texto listo para copiar; el agente registra la respuesta. A los 3 meses del
  enrolamiento se genera un pendiente de encuesta. La calificación de psicooncología es visible para el
  voluntario en la sesión.
- **a9** Tipo de seguro se reporta en dos cortes: al enrolar (perfil de entrada) y vigente (efecto SEPA).

### Decisiones adicionales
- **E7** Por ahora se mantienen los obligatorios actuales del enrolamiento; el resto es opcional.
- **H5** Fuente de establecimientos: el archivo local de la carpeta "Establecimientos de Salud CENEPRED…".
  La importación debe **conciliar** con los hospitales ya creados en prod (ligados a pacientes,
  diagnósticos, tratamientos, citas): emparejar, no duplicar ni romper referencias.
- **H5b (2026-10-28) En pausa.** No se corre `scripts/import-health-centers.ts` ni el emparejamiento
  con CENEPRED; se retoma con una revisión más cuidadosa (simulacro en prod, planilla de revisión,
  categoría MINSA desde RENIPRESS). Mientras tanto los hospitales se mantienen como hoy, cargados a mano.

## 17c. Permisos por rol (validado 2026-10-27)

Correcciones respecto al código actual (el resto de permisos existentes se mantienen):

| # | Recurso | Regla |
|---|---|---|
| R-1 | Call center (carga de agentes) | ADMIN, FOUNDATION |
| R-2 | Resolver alerta | Solo FOUNDATION |
| R-3 | Resumen IA de alerta | ADMIN, AGENT, FOUNDATION |
| R-4 | Editar/archivar catálogos | AGENT los abiertos; ADMIN y FOUNDATION todos |
| R-5 | Fusionar ítems de catálogo | ADMIN |
| R-6 | Agendar sesión de psicooncología | AGENT, FOUNDATION (no VOLUNTEER) |
| R-7 | Cancelar sesión | AGENT, FOUNDATION (no VOLUNTEER) |
| R-8 | Crear acompañante | ADMIN, FOUNDATION, AGENT (no VOLUNTEER) |
| R-9 | Documentos del paciente | VOLUNTEER **no** los ve (ni informes médicos); su "ficha completa" excluye documentos |
| R-10 | Carga histórica | Se mantiene ADMIN; los agentes reciben una **cuenta admin provisional** mientras dure la carga |
| R-11 | Seguimientos en la ficha del paciente | El agente ve **todos** los seguimientos del paciente; "mis seguimientos" es solo un filtro de agenda |
| R-12 | Exportación | ADMIN, FOUNDATION, con registro |
| R-13 | Endpoints sin rol explícito | VOLUNTEER solo accede a fundación (contactos) y a lo de sus sesiones; el resto exige rol |
| R-14 | Gestionar voluntarios | ADMIN y FOUNDATION |

## 18. Pendientes

1. Quién reprograma una sesión de psicooncología (se asume agente y fundación, como cancelar).
2. Revisión de fórmulas de los indicadores ✅ (D4) — durante la auditoría.

## 19. Siguientes pasos acordados

1. Recibir la lista de indicadores y armar la matriz.
2. Contrastar estas reglas con el código de ambos repos, módulo por módulo.
3. Plan de cambios priorizado, empezando por el recorrido del paciente.
4. Escribir los documentos por dominio.
