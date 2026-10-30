# Consultas del asistente de datos

El modo DATA se limita a ADMIN y FOUNDATION. Las herramientas reutilizan
servicios del CRM, validan argumentos y sólo leen datos; no aceptan SQL del
modelo ni realizan envíos o cambios. AGENT conserva el modo DOCUMENTS.

## Búsqueda combinada de pacientes

`search_patients` aplica todos los filtros en el servidor antes de contar y
paginar. Devuelve `total`, `limit`, `offset`, `hasMore`, los filtros aplicados
y una página de pacientes con seudónimos estables P-001…

| Filtros | Significado |
| --- | --- |
| `activityStatus`, `segment` | Activo/inactivo/reactivado; atención o prospectos |
| `healthPhase`, `healthSubcategory` | Fase y subcategoría actuales |
| `gender`, `minAge`, `maxAge` | Sexo M/F/OTHER; edades inclusivas al día de hoy en Lima |
| `department` | Departamento de residencia principal activa, independiente de mayúsculas |
| `healthCenterId` | Hospital principal del paciente |
| `diagnosis`, `cancerStage` | Cualquier diagnóstico vigente que reúna ambos criterios en la misma fila |
| `insuranceType` | Seguro vigente |
| `treatmentType`, `treatmentSituation` | Cualquier tratamiento vigente que reúna ambos criterios en la misma fila |
| `hasCompanion` | Al menos un acompañante vinculado, aunque no sea contacto principal |
| `hasPhone`, `hasEmail` | Presencia de teléfono principal/auxiliar o correo; espacios no cuentan |
| `hasPendingReminders` | Al menos un recordatorio PENDING; no equivale a entrega del aviso |
| `hasPendingFollowUps` | Seguimiento SCHEDULED u OVERDUE sin reemplazo al reagendar |
| `enrolledFrom`, `enrolledTo` | Primer enrolamiento: desde inclusivo, hasta exclusivo |
| `lastContactBefore` | Último contacto COMPLETED anterior al día indicado; excluye pacientes sin contacto completado |

Los filtros booleanos aceptan true y false; omitirlos incluye ambos casos.
Las fechas históricas y los registros con `is_historical` se incluyen. Los
totales cuentan pacientes únicos, aunque tengan varios registros clínicos.
Se rechazan rangos de edad o enrolamiento invertidos.

`latestCurrentDiagnosis` es únicamente el diagnóstico vigente más reciente:
si el paciente tiene varios, puede no ser el que hizo coincidir los filtros.
No representa el historial clínico completo.

## Descubrimiento de códigos

`get_patient_filter_options` consulta un catálogo por `kind`, texto `search`
y paginación. Devuelve código, etiqueta y estado activo. Incluye opciones
inactivas porque pueden seguir registradas en pacientes. Por ejemplo:

- `cancer_diagnosis`: buscar una etiqueta diagnóstica.
- `cancer_stage`: resolver un estadio.
- `treatment_type` y `treatment_situation`: resolver tipo y situación.
- `insurance_type`, `patient_health_phase`, `patient_health_subcategory`.

El modelo debe resolver los códigos antes de usarlos, sin adivinarlos.
`search_health_centers` resuelve nombres de hospitales a IDs.

## Pendientes concretos

`get_call_center_workload` conserva la carga global por agente y agrega
listas paginadas de seguimientos y recordatorios, con paciente seudonimizado,
agente, fecha real y presencia de correo. Permite `patient=P-001`, `agentId`,
`hasEmail`, `limit` y `offset`. Los códigos de pacientes sólo se resuelven
dentro de la conversación que los obtuvo.

Los totales filtrados distinguen cantidad de tareas y cantidad de pacientes.
Un recordatorio pendiente puede estar vencido por fecha. Las páginas de
recordatorios y seguimientos se paginan por separado con el mismo offset.
Los contadores por agente siguen siendo globales, y la respuesta lo indica.

El modelo recibe presencia de contacto, no direcciones de correo, teléfonos,
DNI, nombres reales ni el texto libre de los recordatorios. La API rehidrata
los nombres y enlaces del paciente al presentar la respuesta al usuario.
Los nombres que el usuario escriba en la pregunta siguen llegando tal cual al
modelo, como en la implementación anterior.

## Ejemplos

- Mujeres entre 40 y 65 años residentes en Lima.
- Pacientes con seguro SIS vigente y tratamiento en proceso.
- Pacientes con un diagnóstico concreto en estadio 2.
- Pacientes sin acompañante y con seguimiento pendiente.
- Primeros enrolamientos entre dos fechas, con último contacto anterior a un día.
- Pacientes con correo registrado y algún recordatorio pendiente; consultar
  después las tareas de uno de esos pacientes usando su código.

La prueba automatizada de herramientas cubre permisos, validación,
seudonimización, paginación y resolución de catálogos. El ensayo local usa
además comparaciones contra la base restaurada y fixtures transaccionales
para evitar cruces falsos entre diagnósticos o tratamientos distintos.
