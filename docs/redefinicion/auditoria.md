# Auditoría del sistema contra las decisiones (2026-10-27)

Contraste del código de `fpc-backend` (principal) y `fpc-front` con `decisiones.md`.
Severidad: **🔴 rompe un indicador o una regla núcleo** · **🟠 brecha funcional** · **🟡 deuda / limpieza**.

Alcance real de esta pasada: dashboard completo (fórmulas), enrolamiento, seguimientos, paciente
(update/baja/reactivación/detalles), diagnóstico y estado diagnóstico, tratamientos y versionado,
permisos de todos los controladores, enums de recordatorios/citas/psicooncología, estructura del
front. **No** se revisó línea a línea: timeline, carga histórica, resúmenes IA, documentos,
alertas (más allá de permisos/entidad), y los formularios grandes del front.

---

## 1. Fórmulas de indicadores (`dashboard-indicators.service.ts`)

| # | Sev | Hallazgo | Efecto |
|---|---|---|---|
| F1 | 🔴 | La población por defecto (`ALL_ACTIVE`) usa el `activity_status` **actual** e ignora las fechas (`$1 IS NOT NULL`). | Un mes pasado muestra el estado de hoy. Viola I2. Todas las distribuciones "actuales" son foto de hoy. |
| F2 | 🔴 | Abandono del programa cuenta `activity_status = 'INACTIVE'`, pero las poblaciones `ALL_ACTIVE` y `ACTIVE_IN_PERIOD` **excluyen** a los inactivos. | Con la población por defecto el indicador de abandono sale ~0. Solo funciona con `ENROLLED_IN_PERIOD`. |
| F3 | 🔴 | `abandonedWithBarriers` usa `access_barrier_code` (barrera para **iniciar**) en vez de `treatment_abandonment_reason`. | f4 mide otra cosa. Además no desglosa por motivo. |
| F4 | 🔴 | `benefitSupport` = "tiene algún seguimiento". Todo enrolado tiene uno (el enrolamiento). | Acompañamiento ≈ 100 % siempre; `allThreeBenefits` hereda el error. |
| F5 | 🔴 | `benefitPsychooncology` cuenta cualquier cita (canceladas, no-show, programadas). | Infla e5. Debería contar sesiones realizadas. |
| F6 | 🟠 | Días enrolamiento→SIS: excluye afiliaciones del mismo día, no exige `affiliated_via_sepa`, admite negativos (afiliados antes de enrolar) y promedia filas, no pacientes. | e1 sesgado. |
| F7 | 🟠 | Hito `SYMPTOMS_ONSET` toma `symptom_report.created_at` (fecha de **registro**) cuando no hay `first_symptoms_date`. | Viola I1; síntomas→diagnóstico subestimado. |
| F8 | 🟠 | Diagnóstico→tratamiento usa el **primer** tratamiento de cualquier diagnóstico; sin guarda de negativos. Pacientes con historial previo dan valores negativos. | e3 sesgado. |
| F9 | 🟠 | Primera consulta→diagnóstico usa la primera cita registrada, no `first_primary_care_via_sepa_at` como pide el PDF; no se limita a signos y síntomas. | e2 mide otra población. |
| F10 | 🟠 | Morbilidad / estadio / tipo y situación de tratamiento toman **un** diagnóstico y **un** tratamiento por paciente (`DISTINCT ON`). | Pacientes con varios diagnósticos/tratamientos (pedido E17/E18 del cliente) pierden datos. |
| F11 | 🟠 | Muertes y eventos de diagnóstico confirmado/descartado no se filtran por cohorte ni departamento. | Inconsistentes con el resto del panel cuando hay filtro. |
| F12 | 🟠 | Cumplimiento quimio/radio y hormonal detectan el tipo con `ILIKE '%quimio%'`, `'%radio%'` (atrapa "Radioyodo"), `'%hormona%'`. | Clasificación frágil; debe salir del catálogo (C1). |
| F13 | 🟠 | Afiliación SIS por SEPA (d1) lee `patient_insurance.affiliated_via_sepa`; e1 lee `patient_sis_affiliation`. | Dos fuentes para el mismo hecho. |
| F14 | 🟡 | Abandono del programa mezcla `program_dropout_reason_code` y `deactivation_reason` con un mapeo manual. | Dos fuentes con enums distintos (g1). |
| F15 | 🟡 | Satisfacción (c1–c4) no está en el dashboard. Filtros: solo fechas y departamento (faltan hospital, agente, fase, subcategoría — D3). | Brecha conocida. |

## 2. Recorrido del paciente

### Enrolamiento (`enrollments.service.ts`)
| # | Sev | Hallazgo | Regla |
|---|---|---|---|
| E-a | 🔴 | Un paciente ya enrolado no puede volver a enrolarse (`PATIENT_ALREADY_ENROLLED`) y no hay flujo "reactivar con datos nuevos". | E6 |
| E-b | 🟠 | La subcategoría no se deriva de los tratamientos; se envía a mano o queda vacía. | E4 |
| E-c | 🟠 | Acompañantes son filas de `patients` con `role = COMPANION`. | A1 (entidad propia) |
| E-d | 🟡 | Dos caminos legados en paralelo: `diagnosis` vs `diagnoses[]`, y contactos "implícitos" vs `contacts[]` explícitos, con reglas distintas en cada uno. | Parche sobre parche |
| E-e | 🟡 | Sigue encolando webhooks n8n (registro/cita); solo se desactiva si la URL está vacía. | R2 (n8n en pausa) |
| E-f | 🟡 | Charlas: `talk_name` y `family_member_name` en texto libre, colgadas del enrolamiento. | CH1, CH2 |

### Seguimientos (`follow-ups.service.ts`, `follow-up.entity.ts`)
| # | Sev | Hallazgo | Regla |
|---|---|---|---|
| S-a | 🔴 | **No existe historial por campo.** `update` hace `Object.assign(item, input)` sin registro. Lo mismo en `patients.update`, `deactivate`, `reactivate`. | S2, S3, S4 |
| S-b | 🔴 | Un seguimiento es un solo `type` + `status`; no hay **intentos**. | S5 |
| S-c | 🔴 | No hay estado **vencido** ni proceso que lo marque (el único `@Cron` del backend es de documentos). | S6 |
| S-d | 🟠 | Los cambios de estado del seguimiento no guardan historia. | S6 |
| S-e | 🟠 | El agente solo **lista** sus propios seguimientos, incluso dentro de la ficha del paciente. | R-11 |
| S-f | 🟡 | `assertPatients` calcula un `count` que no se usa. | Limpieza |

### Paciente (`patients.service.ts`)
| # | Sev | Hallazgo | Regla |
|---|---|---|---|
| P-a | 🔴 | `reactivate` **borra** motivo, fecha de baja y fecha de fallecimiento. Se pierde la historia de bajas. | I2, g1 |
| P-b | 🟠 | La baja no queda ligada a un seguimiento ni guarda autor. | S3 |
| P-c | 🟠 | `TREATMENT_ABANDONED` existe como subcategoría y `ABANDONED` como situación de tratamiento: dos fuentes. | I4 |

### Diagnóstico y tratamiento
| # | Sev | Hallazgo | Regla |
|---|---|---|---|
| D-a | 🔴 | El versionado (`HistoryVersioningService.replaceCurrent`) crea la nueva versión **solo con lo que manda el cliente**. Lo que no se reenvía (p. ej. `scheduled_sessions`, `completed_sessions`, motivos) se pierde en la nueva versión. | I2, f1 |
| D-b | 🟠 | Diagnóstico tiene "revisiones" (corrección in situ) y tratamiento tiene "versiones" (fila nueva): dos modelos de historia distintos. | S2 (unificar) |
| D-c | 🟠 | `TreatmentSituation` mezcla ES/EN (`EN_CURSO`, `SEARCHING`, `ABANDONED`…) y no calza con las etiquetas del cliente. | b7–b11 |
| D-d | 🟡 | `OTHER` + texto libre en tipo de tratamiento, barreras, interrupción, especialidad, abandono, traslado, albergue, desactivación. | C1 |

### Derivaciones / ruta
| # | Sev | Hallazgo | Regla |
|---|---|---|---|
| H-a | 🟠 | Derivación repartida en: `diagnosis.has_referral`/`referred_health_center_id`/`is_sepa_active_referral`, `symptom_report.has_referral`/`referred_via_sepa`, `appointment.has_referral_sheet`/`referred_to`/`referred_via_sepa`, `treatment.is_referred`/`source`/`receiving`. | H2 |
| H-b | 🟠 | `health_center.category` texto libre; sin nivel, institución ni ubigeo. | H1 |

## 3. Recordatorios, psicooncología, alertas

| # | Sev | Hallazgo | Regla |
|---|---|---|---|
| R-a | 🟠 | Recordatorio: sin canal, sin anticipación (2 h / 1 día / manual), sin estado de envío, sin correo. | R2–R4 |
| R-b | 🟠 | Recordatorio tiene `resulting_follow_up_id` (un recordatorio "genera" seguimiento). | R1 |
| R-c | 🟠 | Sesión de psicooncología: estados sin `RESCHEDULED` ni vencida; usa `NO_ANSWER` como "no se presentó"; sin cierre de ciclo. | P3, P13 |
| R-d | 🟠 | Sin recordatorio propio de sesión ni bloqueo por falta de link Zoom. | P6 |
| R-e | 🟠 | Alertas: estados ACTIVE/RESOLVED (falta "en revisión" explícito, hay un boolean `under_review`), una alerta = un seguimiento (no N pacientes), dos columnas de resolutor, `OTHER`. | AL2–AL9 |

## 4. Permisos
Ver `decisiones.md` §17c (R-1 a R-14). Todas son discrepancias reales del código actual.

## 5. Inexistente (por construir)
Exportación Excel (X1–X2) · Encuestas (EN1) · Derivación (H2) · Acompañante como entidad (A1) ·
Intentos de seguimiento (S5) · Historial por campo (S2) · Vencimiento automático (S6) ·
Fusión de catálogos (C3) · Resend (R3, AL6, AL7) · Asistentes IA (IA2, IA3) · Importación de
establecimientos con conciliación (H5).

## 6. Estructura / deuda técnica

- **Front:** `clinical-data-tabs.tsx` (6 036 líneas), `step-7-atencion.tsx` (2 979), `step-5-datos.tsx`
  (1 483), `follow-up-content.tsx` (1 311), `overview-section.tsx` (1 199). Archivos así esconden bugs
  y duplicación; deben partirse por dominio.
- **Back:** `patient-timeline.service.ts` (1 382), `dashboard-indicators.service.ts` (1 130, SQL en
  strings), `historical-clinical.util.ts` (705) — este último re-implementa reglas clínicas en paralelo
  a los servicios normales (riesgo de divergencia).
- El filtro de departamento se interpola en SQL (mitigado por regex, pero debe ir parametrizado).
- 66 migraciones; la vista `patient_clinical_milestones` se redefinió en dos migraciones.
- Todas las rutas del OpenAPI se usan desde el front (no hay endpoints muertos), salvo `DELETE`
  de medicamentos.

---

## 7. Prioridad propuesta

1. **Base de trazabilidad** — historial por campo (S-a) + corregir versionado que pierde datos (D-a) +
   no borrar historia al reactivar (P-a). Sin esto todo lo demás miente.
2. **Seguimientos** — intentos, vencido, historia de estados, visibilidad en ficha (S-b..S-e).
3. **Fórmulas rotas** — F1–F5 (población temporal, abandono, beneficios), luego F6–F13.
4. **Unificar fuentes duplicadas** — afiliación SEPA, abandono/baja, subcategoría vs situación, enums de
   situación de tratamiento, `OTHER` → catálogo.
5. **Permisos** R-1..R-14.
6. **Modelo nuevo** — Acompañante, Derivación, hospitales con nivel + importación, Encuestas.
7. **Recordatorios / psicooncología / alertas** según reglas.
8. **Exportación, filtros del dashboard, Resend.**
9. **IA** (asistente de datos y de consulta).
10. **Partir archivos gigantes** a medida que se tocan (no como proyecto aparte).
