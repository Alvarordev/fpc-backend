# Diseño 01 — Base de trazabilidad

Cubre: S2, S3, S4 (historial por campo), D-a (versionado que pierde datos), P-a (reactivar borra
historia). Rama: `refactor/redefinicion`.

## Situación actual

Hay cuatro mecanismos de historia, cada uno distinto y ninguno completo:

| Mecanismo | Dónde | Guarda autor | Guarda seguimiento | Guarda valor anterior |
|---|---|---|---|---|
| Versiones `is_current` (fila nueva por cambio) | seguro, diagnóstico, tratamiento, medicación, cita | no | sí (de la versión) | sí, pero **pierde campos no reenviados** |
| `patient_diagnosis_revisions` (corrección in situ) | diagnóstico | sí | sí | sí (JSON) |
| `patient_health_phase_history` / subcategoría | fase y subcategoría | no | no | implícito |
| `patient_diagnostic_status_events` | estado diagnóstico | no | sí | implícito |

Y todo lo demás (paciente, detalles, direcciones, seguimientos, recordatorios, citas de psicooncología,
acompañantes, baja/reactivación) **se pisa sin registro**.

## Propuesta

### 1. Un único registro de cambios: `change_log`

```
change_log
  id               uuid
  change_set_id    uuid        -- agrupa todos los cambios de una misma operación
  patient_id       uuid null   -- para la línea de tiempo y la exportación
  entity_type      varchar     -- 'patient', 'patient_details', 'follow_up', 'patient_treatment', ...
  entity_id        uuid
  operation        varchar     -- CREATE | UPDATE | DELETE
  field            varchar null-- null en CREATE/DELETE (el snapshot va en new/old_value)
  old_value        jsonb null
  new_value        jsonb null
  context          varchar     -- FOLLOW_UP | ADMIN_ADJUSTMENT | HISTORICAL_LOAD | SYSTEM
  follow_up_id     uuid null   -- obligatorio cuando context = FOLLOW_UP
  actor_user_id    uuid null   -- null solo para SYSTEM (p. ej. el job de vencidos)
  changed_at       timestamptz
```

- **Una fila por campo cambiado** (opción B acordada). Un `change_set_id` permite mostrar "en el
  seguimiento X, Lucía cambió estos 7 campos".
- **Contexto** responde S3: si el cambio no viene de un seguimiento, queda como ajuste administrativo
  con su autor.
- Editar un seguimiento ya cerrado (S4) genera filas con `entity_type = 'follow_up'` y el mismo
  mecanismo; "si se editó un seguimiento" = existe un UPDATE posterior a su cierre.

### 2. Cómo se captura (sin depender de que cada servicio se acuerde)

- **Contexto por request** con `AsyncLocalStorage`: un interceptor guarda `actor`, `context` y
  `followUpId` (se lee del body/params o lo fija el servicio, p. ej. el enrolamiento).
- **Subscriber de TypeORM** (`afterInsert`, `afterUpdate`, `afterRemove`) sobre una lista blanca de
  entidades del paciente: calcula el diff contra `databaseEntity` y escribe en `change_log` dentro de
  la misma transacción.
- Regla para el código: las entidades auditadas se escriben con `save()`/`remove()`, **no** con
  `QueryBuilder.update()` (que no dispara subscribers). Un test de arquitectura lo verifica.
- Campos excluidos del diff: `updated_at`, `created_at`, contraseñas/tokens, contenido de documentos.

### 3. Versionado que no pierde datos (D-a)

`replaceCurrent` pasa a **heredar** la versión vigente:

```
nueva_version = { ...version_vigente_sin_id_ni_fechas, ...valores_enviados }
```

- `undefined` = "no lo tocaste, se conserva"; `null` explícito = "se borró".
- Los servicios que hoy fuerzan `null` cuando un campo no aplica (p. ej. motivo de abandono si la
  situación no es abandono) siguen funcionando igual, porque mandan `null` explícito.
- Se mantiene el modelo de versiones por fila (sirve para "estado en tal fecha"), pero además cada
  versión nueva escribe en `change_log` solo los campos que cambiaron.

### 4. Baja y reactivación sin borrar historia (P-a)

```
patient_activity_events
  id, patient_id, status (ACTIVE|INACTIVE|REACTIVE),
  reason (catálogo), reason_detail, deceased_on date null,
  follow_up_id null, actor_user_id, occurred_at
```

- `deactivate` y `reactivate` **agregan** un evento; las columnas actuales de `patients` quedan como
  caché del último estado.
- Los indicadores de abandono y mortalidad leen los eventos (sirve para "inactivos al cierre de
  marzo", F1/F2).
- Unifica las dos fuentes de abandono (F14): `program_dropout_reason_code` y `deactivation_reason`
  pasan a ser un solo motivo de catálogo en el evento.

### 5. Qué pasa con los mecanismos existentes

- `patient_diagnosis_revisions`: se migran sus filas a `change_log` y la tabla se retira.
- Historias de fase/subcategoría y eventos de estado diagnóstico: **se conservan** (son eventos de
  negocio que alimentan indicadores), pero ahora con `follow_up_id` y `actor` vía el mismo contexto.
- La línea de tiempo del paciente lee `change_log` para "qué cambió en este seguimiento".

## Migración de datos en producción

1. `change_log` arranca vacío: no hay forma de reconstruir cambios pasados que nunca se guardaron.
   Lo que sí existe (revisiones de diagnóstico) se migra.
2. `patient_activity_events`: se crea un evento por paciente con su estado actual
   (inactivos con su motivo y fecha). Las bajas que ya se borraron al reactivar **no son recuperables**.
3. Versiones con campos perdidos: antes de corregir, un **reporte** que liste por serie de tratamiento
   qué campos tenían valor en la versión anterior y quedaron vacíos en la siguiente
   (`scheduled_sessions`, `completed_sessions`, motivos, etc.). Con ese reporte se decide si se
   rellenan automáticamente o a mano — no se toca nada a ciegas.

## Decisiones que necesito

1. ¿Te parece bien una sola tabla `change_log` por campo como fuente de verdad del historial?
2. Para las versiones con datos perdidos en prod: ¿primero el reporte y decidimos con los números?
   (recomendado) ¿O rellenar automáticamente lo que se pueda heredar de la versión anterior?
3. ¿Quién puede ver el historial de cambios en la ficha? Propuesta: ADMIN, FOUNDATION y AGENT;
   VOLUNTEER no.

## Decisiones tomadas (2026-10-27)
1. Una sola tabla `change_log` por campo. Se captura con **triggers de Postgres** (no subscriber de
   TypeORM): ninguna vía de escritura puede saltarla. El backend pasa actor/contexto/seguimiento en
   `app.audit` al iniciar cada transacción.
2. Datos perdidos en prod: primero el reporte `scripts/reports/treatment-version-gaps.sql`.
3. Ver historial: ADMIN, FOUNDATION, AGENT (`GET /patients/:id/change-log`).

## Implementado
- `src/shared/audit/*`: contexto por request (AsyncLocalStorage), interceptor global, subscriber que
  hace `set_config('app.audit')`, decoradores `@AuditContext` y `@AuditFollowUpParam`.
- Migración `1784920000000`: `change_log`, `audit_write()`, `audit_row_change()`, triggers en 25
  tablas del paciente, migración de `patient_diagnosis_revisions` (tabla eliminada),
  `patient_activity_events` con un evento inicial por paciente.
- Versionado: `inherit` opcional (líneas de tratamiento y edición de cita); el diff entre versiones
  se registra como UPDATE por campo (incluye `id` viejo → nuevo).
- Baja/reactivación: eventos con motivo, seguimiento opcional y autor.
- Enrolamiento: todo lo que escribe queda en un solo change set ligado a su seguimiento.

Verificado en vivo (compose `fpc-redef`): ajuste administrativo, edición de seguimiento,
alta de diagnóstico/tratamiento, actualización parcial de tratamiento (hereda situación,
sesiones y fecha), corrección de diagnóstico, baja/reactivación, enrolamiento completo,
migración de revisiones (encadenado de valores) y reporte de brechas.

Pendiente de este punto: mostrar el historial en el front (ficha del paciente / seguimiento).
