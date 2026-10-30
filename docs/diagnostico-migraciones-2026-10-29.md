# Diagnóstico de migraciones sobre respaldo de producción

Fecha de la prueba: 2026-10-29. Backend: `fpc-backend-redefinicion`, rama
`refactor/redefinicion`, commit `34b9127a9d3bbea78e84dc4e74bf07d6a9fc64f1`.

## Dictamen

Las 14 migraciones pendientes se ejecutan correctamente sobre el respaldo en
PostgreSQL 18.6 y PostgreSQL 16.14. Sin embargo, **no cumplen conservación total
de información**: se borran 17 valores de categoría de establecimientos y un
valor de parentesco. Además, cuatro intereses en charlas pierden la referencia
directa al enrolamiento de origen. Resolver estas pérdidas antes de considerar
validado el despliegue bajo el requisito de no perder datos.

No se modificaron las migraciones ni la base `fpc_dev`. Las pruebas utilizaron
bases separadas. No se conectó a producción ni se enviaron mensajes externos.

## Respaldo y método

- Archivo: `fpc-fpcdb-smdeyl_postgres_daily_2026-10-29T00-00-00-075Z.sql.gz`.
- SHA-256 del archivo comprimido:
  `02d75e6caa5ab9d5874d2aa98650b376a2f63459c36abf3a2c303142462e6e8e`.
- Integridad gzip correcta. Contenido real: archivo CUSTOM de `pg_dump`,
  formato 1.16; no es SQL de texto. Tamaño descomprimido: 1.085.298 bytes.
- Generado el 2026-10-29 a las 00:00 UTC desde PostgreSQL 18.6 con `pg_dump` 18.6.
- Restauración PostgreSQL 18 con `pg_restore --exit-on-error
  --single-transaction --no-owner --no-privileges`: sin errores.
- Baseline: 50 tablas, 8.647 filas, 66 migraciones aplicadas. Última:
  `AddDiagnosisDiseaseEvolution1784918000000`.
- Se compiló el backend con `npm run build` y se usó el mismo ejecutor de
  producción: `npm run migration:run:prod`, transacción `all`.
- Comparación completa de filas de las tablas originales mediante snapshots
  JSON; tablas sin columna `id` comparadas como conjuntos de filas completas.
  Comprobaciones adicionales para datos que cambian de tabla o código.
- Capturas y respaldos con información sensible quedaron en el directorio
  local privado `.local-migration-audit/2026-10-29/`, excluido de Git mediante
  `.git/info/exclude`. Este informe contiene únicamente agregados.

## Resultados de las comprobaciones

| Comprobación | Resultado |
| --- | --- |
| Migraciones pendientes sobre respaldo | 14/14 correctas, en PostgreSQL 18 y 16 |
| Segunda ejecución en ambas versiones | Sin migraciones pendientes |
| Base vacía en PostgreSQL 18 | 80/80 migraciones correctas |
| Restricciones CHECK/FK antes | 165 revalidadas, ninguna previamente sin validar |
| Restricciones CHECK/FK después | 236 revalidadas, ninguna previamente sin validar |
| Índices después | Ninguno inválido o no preparado |
| Lectura ORM de entidades | 60/60 consultas correctas |
| API: 22 rutas de lectura | 22 respuestas HTTP 200 |
| API: detalle de todos los pacientes PATIENT | 307/307 respuestas HTTP 200 |
| Fallo controlado tras las 14 migraciones | Rollback de todos los datos originales |

La API se levantó temporalmente en otra copia, con JWT local, seis cron jobs
detenidos, almacenamiento en memoria e integraciones externas desactivadas.
Las rutas revisadas incluyen salud, pacientes, seguimientos, recordatorios,
establecimientos, catálogos, encuestas, charlas, enrolamiento, referencias,
timeline y los siete grupos de indicadores del dashboard. Para dashboard se
usó `period=year&year=2026`. No se hicieron pruebas de interfaz ni escrituras
de negocio ni se verificó la exactitud de cada indicador frente a una fuente
externa.

El fallo controlado se inyectó en una migración de prueba posterior a las 14
reales, sin editar el código del producto. Las 50 tablas originales quedaron
con datos idénticos, también las 66 filas originales de `migrations`, y las
columnas originales de tablas/vista quedaron restauradas. TypeORM deja una
tabla auxiliar vacía `typeorm_metadata`, creada antes de la transacción;
por ello el esquema completo no queda literalmente idéntico. Las secuencias
pueden consumir números durante una transacción abortada.

## Conservación y transformaciones verificadas

| Datos | Antes | Después | Validación |
| --- | ---: | ---: | --- |
| Pacientes con rol PATIENT | 307 | 307 | Mismos IDs |
| Registro UNKNOWN | 1 | 1 | Conservado |
| Acompañantes originales | 183 en patients | 183 en companions | Mismos IDs y 12 campos de identidad/contacto/fechas |
| Acompañantes adicionales | 0 | 1 | Creado desde interés en charla |
| Vínculos acompañante-paciente | 183 | 184 | Los 183 originales conservan IDs y extremos |
| Seguimientos | 2.468 | 2.468 | Mismos IDs y equivalencia de interlocutores |
| Intentos de seguimiento | 0 | 2.428 | Canal, paciente y resultado derivados correctamente |
| Enrolamientos | 307 | 307 | Conservados |
| Encuestas | 0 | 36 | Calificaciones y paciente/seguimiento conservados |
| Tratamientos | 321 | 321 | 318 códigos renombrados según mapa; 321 situaciones verificadas |
| Establecimientos | 137 | 137 | Se conserva la fila, con pérdidas de categoría descritas abajo |
| Intereses familiares en charlas | 4 | 4 | Conservados charla, paciente, fecha y teléfono del familiar |
| Eventos de actividad | 0 | 307 | Uno por paciente PATIENT |
| Referencias | 0 | 112 | Nuevas filas derivadas; los campos originales de origen permanecen |

Se compararon 142.631 valores de columnas comunes en tablas con `id`:
142.209 idénticos y 422 modificaciones limitadas a campos previstos por las
migraciones (catálogos, parentescos y situación del tratamiento). Las tablas
originales sin `id` también quedaron idénticas. Esto no incluye como
"conservadas" las columnas eliminadas: se revisaron separadamente.

Las tablas pasan de 50 a 69 y las filas de 8.647 a 11.720. El aumento no es
una prueba por sí solo de conservación; incluye los datos derivados nuevos.

## Hallazgos

### 1. Pérdida de 17 categorías de establecimientos

En `1784925000000-AddHealthCenterLevelsReferralsAndCatalogMerges.ts`, líneas
17–30, sólo se copian categorías MINSA reconocibles a `care_category` y luego
se elimina `category`.

- Nueve valores `NO_ESPECIFICA` pasan a `NULL`.
- Ocho valores `SIN_CATEGORIA` pasan a `NULL`.
- Los otros 120 establecimientos conservan su categoría reconocida.

Se pierde la distinción entre categoría no especificada y establecimiento sin
categoría. Conservar el valor original en un campo de procedencia o definir
un mapeo explícito que mantenga ambas situaciones antes de borrar la columna.

### 2. Un parentesco OTHER se elimina

En `1784930000000-CompanionsAsEntity.ts`, la actualización anterior a la
creación de entradas libres del catálogo convierte `OTHER` a `NULL`.
Hay un vínculo afectado en este respaldo. Los otros textos libres se
transforman en códigos de catálogo.

Conservar una opción explícita de catálogo para "Otro" o el valor original.
La existencia del vínculo no se pierde, pero sí esta información del vínculo.

### 3. Procedencia de cuatro intereses en charlas

`1784931000000-CompanionTalkInterests.ts`, líneas 94–103, conserva paciente,
acompañante, charla, fecha y seguimiento, pero no conserva el `id` original
del interés ni `enrollment_id`; posteriormente borra la tabla de origen.
Los cuatro intereses migran, incluidos los cuatro teléfonos de familiares,
pero se pierde la referencia directa al enrolamiento que los capturó.

Si debe conservarse trazabilidad de origen, agregar `source_enrollment_id` y
`legacy_interest_id`, o una tabla de correspondencias. El uso de `DISTINCT ON`
y la unicidad por acompañante/charla también pueden colapsar ocurrencias en
otros conjuntos de datos; en este respaldo no se observó reducción de filas.

### 4. Incompatibilidad de restauración directa con PostgreSQL 16

El `pg_restore` 16 local rechaza el formato 1.16 del archivo. El cliente 18
puede leerlo, pero la restauración estricta contra el servidor 16 falla con
`unrecognized configuration parameter "transaction_timeout"`.

La prueba de compatibilidad se realizó exportando SQL con `pg_restore` 18 y
omitiendo exclusivamente la línea `SET transaction_timeout = 0;`; se aplicó
con `psql -X --single-transaction -v ON_ERROR_STOP=1`. Esa restauración y las
14 migraciones terminaron correctamente. Se repitieron las 20 verificaciones
de conservación y las 236 restricciones en PostgreSQL 16 con el mismo resultado.

Usar PostgreSQL 18 para ensayos fieles a producción. La adaptación anterior
es una comprobación local sobre este respaldo, no una garantía general de
compatibilidad descendente de respaldos PostgreSQL.

### 5. Ruido de auditoría generado durante la migración

Se crean 129 entradas en `change_log`: 112 INSERT de referencias y 17 UPDATE
de `reminders.remind_at`. Son cambios estructurales del backfill. Si el
historial debe distinguir actividad humana de migraciones, etiquetar estos
cambios o suprimir su auditoría de forma consistente con otros backfills.

### 6. Diferencias entre entidades y esquema

La comparación informativa de TypeORM propone 761 sentencias para sincronizar
el esquema, incluidas eliminaciones de columnas. No se ejecutó ninguna.
Las 60 entidades son consultables y los endpoints probados funcionan, pero
esto no acredita coincidencia exacta entre decoradores y esquema. El conjunto
incluye convenciones de nombres, estructuras heredadas y cambios de tipos;
no se clasificó individualmente cada sentencia. Mantener `synchronize: false`
y revisar cualquier migración autogenerada antes de aplicarla.

## Límites y próximos pasos

Las tablas de alertas, sesiones de psicooncología, documentos y revisiones de
diagnóstico están vacías en este respaldo. Su DDL pasa, pero los backfills
correspondientes no se ejercitan con registros reales. Los campos eliminados
de abandono del programa y el vínculo de recordatorio a seguimiento también
están vacíos. Probar estos casos con fixtures representativos antes del
despliegue. Las migraciones de acompañantes y charlas declaran `down()` no
soportado: después de un despliegue confirmado, el retorno exige restauración
de respaldo y una estrategia para las escrituras posteriores.

Prioridad: preservar categorías y parentesco; decidir la conservación de
procedencia de charlas; repetir este ensayo desde el respaldo original después
de cualquier corrección; completar casos de backfill ausentes del respaldo.
Este diagnóstico no aplica correcciones al producto ni autoriza el despliegue.

## Entorno que queda disponible

- Contenedor `fpc-migration-audit-20261029`, PostgreSQL 18.6, puerto
  `127.0.0.1:55432`, volumen `fpc_migration_audit_20261029`.
- `production_baseline`: respaldo restaurado sin migrar.
- `migration_redef`: copia migrada, sin actividad de la API.
- `migration_empty`: instalación desde cero.
- `migration_rollback`: copia usada para fallo y rollback controlados.
- `migration_api`: copia usada para pruebas de lectura de la API; esa API
  temporal se cerró al acabar las consultas.
- En PostgreSQL 16 local: `fpc_audit_20261029`, copia restaurada y migrada.
  La base habitual `fpc_dev` permanece intacta.

Evidencias locales: `restore.log`, `migration-first.log`,
`migration-second.log`, `migration-empty.log`, `migration-pg16.log`,
`restore-pg16-strict.log`, `restore-pg16-compatible.log`, `before.json`,
`after.json`, `after16.json`, `verification-summary.json`,
`verification16-summary.json`, `integrity.json`, `integrity16.json`,
`api-smoke.json`, `rollback-result.json` y `schema-diff.sql`.
Los scripts de diagnóstico `audit.cjs`, `verify.cjs`, `entity-check.cjs`,
`api-smoke.cjs` y `rollback.cjs` están en el mismo directorio privado.

## Prueba manual posterior: registros históricos ocultos

La prueba manual detectó una inconsistencia que los checks HTTP iniciales no
detectaban: el timeline mostraba seguimientos existentes y la pestaña
Seguimiento aparecía vacía. La consulta de listado excluía
`is_historical = true`. En el caso revisado, los seis seguimientos, incluido
el enrolamiento, estaban marcados como históricos. Los datos estaban en la
base; el problema era su visibilidad.

Regla de producto confirmada: `is_historical` registra procedencia anterior
al CRM y no debe excluir registros de listados, contadores o visualizaciones.

Se retiraron las condiciones de visibilidad por esta marca de seguimientos,
recordatorios, sesiones de psicooncología, disponibilidad, calendario de
voluntarios y carga del call center. También se retiró la condición de
procedencia de los resultados de citas médicas asociados al timeline. Los
filtros de estado, fecha y permisos siguen aplicándose. Las protecciones de
acciones y procesos automáticos de envío no forman parte de este cambio de
visibilidad.

Se corrigió además la presentación de seguimientos sin hora: usan
`completedOn`/`scheduledOn` antes de recurrir a la fecha de creación y sólo
muestran hora cuando existe. El call center acepta recordatorios con
`dueOn` y `dueAt = null`; su contrato API y su presentación se actualizaron.

Validación posterior sobre el código corregido:

- Los 2.468 seguimientos se recuperan por ID en las fichas de los 307 pacientes
  que tienen seguimientos; el listado general también los incluye.
- El caso reportado muestra seis registros, tres completados, tres sin
  respuesta y un enrolamiento. Último contacto: 14 de octubre de 2026.
- Prueba de navegador en escritorio y móvil: seis tarjetas históricas,
  enrolamiento visible y filtro de tres registros sin respuesta.
- En una base separada `migration_visibility`, se agregaron dos sesiones de
  psicooncología y dos disponibilidades de prueba. Se consultaron ocho rutas
  antes y después de marcar todos los registros de las cuatro tablas como
  históricos. Se compararon las respuestas sin el propio atributo de
  procedencia y sin considerar el orden entre empates: mismos datos y
  contadores en ambos casos, incluidos 2.468 seguimientos, 196 recordatorios
  y las sesiones/disponibilidades de prueba.
- Las fixtures y los cambios de marca se limitaron a la base de prueba,
  sin modificar los datos de `migration_manual` ni el respaldo baseline.

Evidencias privadas: `follow-up-history-result.json`,
`follow-up-ui-result.json`, `history-visibility-result.json` y los scripts
`check-follow-up-history.cjs`, `check-follow-up-ui.cjs`,
`check-history-visibility.cjs`. El frontend y backend locales se actualizaron
con estas correcciones; los cambios de código todavía no se han confirmado
en Git ni desplegado a producción.
