# Spec: Catálogos del CRM y seed de staging

- Estado: En implementación
- Fecha: 2026-09-02
- Alcance: backend NestJS, contrato OpenAPI y frontend FPC
- Primera versión: marcha blanca (Fases 0–3 en backend; Fase 4 en front)

## 1. Contexto

El CRM de la Fundación Peruana de Cáncer arranca marcha blanca: se resetea
staging, se deja un administrador y datos de referencia (hospitales, ubigeo,
opciones de formularios) y se carga historia clínica operativa desde cero.

Hoy las opciones de formularios están repartidas:

1. **Enums TypeScript + CHECK en PostgreSQL** (estadios, educación, seguros,
   departamentos, etc.). El backend valida códigos; OpenAPI los expone sin
   labels en español. El frontend mantiene mapas `code → label`.
2. **Texto libre** (`diagnosis`, `diagnosisSpecialty`, `nativeLanguage`,
   `province`, `district`, `entrySource`, `treatmentType`, …). Si hay
   dropdown, la lista vive en el frontend o solo en el seed demo.
3. **Tabla real** `health_centers` con CRUD en `/health-centers`.

El objetivo de producto es que **las opciones vivan en el backend** y que el
personal de FPC pueda **editarlas desde una pantalla de configuración**, sin
redeploy. Este spec es el contrato canónico entre fases y PRs.

## 2. Objetivos

1. Resetear staging de forma segura y reproducible (`seed:staging`).
2. Dejar un único perfil `ADMIN` y el voluntario anónimo de sistema.
3. Sembrar ~40 hospitales de referencia peruanos.
4. Centralizar catálogos configurables en `catalog_items`.
5. Servir ubigeo INEI (departamento → provincia → distrito) desde el backend.
6. Exponer lectura y escritura de catálogos por API.
7. Documentar el contrato de la UI de configuración (implementación en el
   repo frontend).

## 3. Principios de diseño

| Qué | Dónde vive | ¿Editable en config? |
| --- | --- | --- |
| Estados de flujo, roles, IDs de máquina | Enum TS + CHECK | No |
| Hospitales | `health_centers` | Sí (CRUD existente) |
| Diagnósticos, especialidades, lenguas, seguros, educación, estadios, fuentes de ingreso, proveedores SEPA, zona, etc. | `catalog_items` | Sí |
| Ubigeo INEI | `ubigeo_departments`, `ubigeo_provinces`, `ubigeo_districts` | No borrar códigos oficiales; labels/activo sí |
| Labels en español | `catalog_items.label` o labels de flujo fijos en front/OpenAPI | Sí para catálogos |

Reglas:

- **No migrar columnas existentes a FK** en la marcha blanca. Los forms
  siguen grabando el `code` (string/enum) que ya acepta la API.
- Los estadios (`STAGE_1`…`UNKNOWN`) se seedan con `isSystem = true`: se
  puede cambiar el label, no el código clínico ni borrar el ítem.
- Hospitales **no** entran a `/catalogs`; siguen en `/health-centers`.
- Ubigeo: `department.code` coincide con `PERU_DEPARTMENTS`
  (`LIMA`, `LA_LIBERTAD`, …). Lima Metropolitana es la provincia Lima
  (INEI `1501`).

## 4. Inventario back / front

### 4.1 Enums cerrados → filas `catalog_items` con `isSystem = true`

| Kind | Códigos actuales | Uso |
| --- | --- | --- |
| `cancer_stage` | `STAGE_1`…`STAGE_4`, `UNKNOWN` | Diagnóstico |
| `education_level` | `INITIAL`…`NONE` | Ficha paciente |
| `insurance_type` | `SIS`, `ESSALUD`, `EPS`, … | Seguro |
| `eps_provider` | `RIMAC`, `PACIFICO`, … | Seguro EPS |
| `health_center_category` | `I-1`…`III-2` | Hospitales |
| `care_program` | `COPHOES`, `PADOMI` | Tratamiento |
| `access_barrier` | `TRANSFER`, `LODGING`, … | Tratamiento |
| `treatment_situation` | `EN_CURSO`, `SEARCHING`, … | Tratamiento |
| `sepa_shelter` | `FRIEDA_HELLER`, … | Ficha SEPA |
| `sepa_transport` | `CRUZ_DEL_SUR`, … | Ficha SEPA |
| `program_dropout_reason` | `VOLUNTARY`, … | Baja del programa |
| `zone_type` | `URBANA`, `RURAL` | Hoy texto libre; se formaliza |
| `patient_health_phase` | `CANCER_DIAGNOSIS`, … | Fase clínica |
| `patient_health_subcategory` | `ACTIVE_TREATMENT`, … | Subcategoría |

### 4.2 Texto libre → catálogos abiertos (`isSystem = false` por defecto)

| Kind | Campo actual | Notas |
| --- | --- | --- |
| `cancer_diagnosis` | `patient_diagnoses.diagnosis` | Lista sugerida; el API sigue aceptando string |
| `medical_specialty` | `diagnosis_specialty`, citas | Idem |
| `native_language` | `patient_details.native_language` | Castellano, Quechua, … |
| `entry_source` | `enrollments.entry_source` | Jerarquía con `parentCode` |
| `entry_sub_source` | `enrollments.entry_sub_source` | `parentCode` = entry_source |
| `treatment_type` | `patient_treatments.treatment_type` | Quimioterapia, etc. |

### 4.3 No configurables (permanecen enum de flujo)

`UserRole`, `PatientStatus`, `PatientActivityStatus`, `FollowUpStatus`,
`FollowUpType`, `FollowUpPurpose`, `ReminderStatus`, `ReminderKind`,
`MedicalAppointmentStatus`, `AlertStatus`, `AlertSeverity`, `AddressType`,
`PatientRole`, `DeactivationReason`, `DoseUnit`, `MedicationRoute`, etc.

### 4.4 Ubigeo

- Departamentos: 25 (incluye Callao).
- Provincias: todas las del INEI; Lima Metropolitana = provincia Lima.
- Distritos: seed completo vendorizado; filtrable por departamento/provincia.

## 5. Modelo de datos

### 5.1 `catalog_items`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid PK | |
| `kind` | varchar(50) | ver lista de kinds |
| `code` | varchar(100) | único por kind; inmutable tras crear |
| `label` | varchar(255) | texto UI en español |
| `parent_code` | varchar(100) null | jerarquía (entry_sub_source → entry_source) |
| `sort_order` | int | default 0 |
| `is_active` | boolean | soft hide |
| `is_system` | boolean | no se archiva; code fijo |
| `metadata` | jsonb null | extensiones |
| `created_at` / `updated_at` | timestamptz | |

Constraint: `UNIQUE (kind, code)`.

### 5.2 Ubigeo

- `ubigeo_departments(code PK, inei_code unique, name, sort_order, is_active)`
- `ubigeo_provinces(inei_code PK, department_code FK, name, sort_order, is_active)`
- `ubigeo_districts(inei_code PK, province_inei_code FK, name, sort_order, is_active)`

`ubigeo_departments.code` = valor de `PERU_DEPARTMENTS` usado en
`health_centers.department` y `patient_addresses.department`.

## 6. Contrato de API

```
GET    /catalogs?kind=&includeInactive=
GET    /catalogs/ubigeo?department=&province=
POST   /catalogs                 (ADMIN)
PATCH  /catalogs/:id             (ADMIN)
POST   /catalogs/:id/archive     (ADMIN)
```

### 6.1 Item de respuesta

```json
{
  "id": "uuid",
  "kind": "cancer_stage",
  "code": "STAGE_3",
  "label": "Estadio III",
  "parentCode": null,
  "sortOrder": 30,
  "isActive": true,
  "isSystem": true,
  "metadata": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 6.2 Ubigeo

`GET /catalogs/ubigeo?department=LIMA` →

```json
{
  "departments": [
    {
      "code": "LIMA",
      "ineiCode": "15",
      "name": "Lima",
      "provinces": [
        {
          "ineiCode": "1501",
          "name": "Lima",
          "districts": [
            { "ineiCode": "150101", "name": "Lima" }
          ]
        }
      ]
    }
  ]
}
```

Sin query: todos los departamentos con provincias (distritos opcionales vía
`province=` para no hinchar la respuesta).

### 6.3 Escritura

- `POST`: crea ítem no-system. `code` obligatorio, único por kind.
- `PATCH`: `label`, `sortOrder`, `isActive`, `metadata`, `parentCode`.
  No cambia `code` ni `kind`. Ítems system permiten cambiar label/orden/activo.
- `POST .../archive`: `isActive = false`. Rechaza si `isSystem = true`.

Lectura: autenticada (cualquier rol del CRM). Escritura: solo `ADMIN`.

## 7. Seed de staging (`npm run seed:staging`)

1. Guard: si `NODE_ENV=production` exige `SEED_STAGING_FORCE=true`.
2. Truncate de tablas de dominio (incluye `foundations`, antecedentes de
   salud, `catalog_items`, ubigeo). **No** toca `migrations`.
3. Restaura `patient_summary_rate_limits` (`gemini`).
4. Crea admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).
5. Restaura voluntario anónimo `voluntario-no-identificado@fpc.system`.
6. Inserta ~40 hospitales activos.
7. Inserta catálogos + ubigeo (idempotente / full replace tras truncate).

**No** usar `seed:demo` en staging: borra y carga pacientes ficticios.

### Procedimiento Dokploy (manual)

1. Backup de la base staging desde Dokploy.
2. Ejecutar migraciones pendientes en el contenedor API.
3. Ejecutar:

```bash
SEED_STAGING_FORCE=true node dist/database/seeds/staging.seed.js
```

(con `DATABASE_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` ya en el
entorno del contenedor).

## 8. Fases

| Fase | Entregable | Repo |
| --- | --- | --- |
| 0 | Este spec | backend |
| 1 | `seed:staging`, truncate completo, admin, hospitales, docs DEPLOY | backend |
| 2 | Tablas + seed catálogos/ubigeo + `GET` | backend |
| 3 | `POST` / `PATCH` / `archive` | backend |
| 4 | Pantalla Configuración + cablear selects | frontend |
| 5 | (Opcional) FK `catalog_item_id` en columnas | backend + front |

## 9. Contrato frontend (Fase 4)

### 9.1 Pantalla Configuración → Catálogos

- Solo `ADMIN` (opcionalmente `FOUNDATION` en lectura).
- Tabs o sidebar por `kind`.
- Columnas: label, code (solo lectura tras crear), activo, system badge,
  orden, acciones.
- Crear: code + label (+ parent si aplica).
- Editar label/orden/activo.
- Archivar (no disponible si `isSystem`).
- Sección aparte “Hospitales” reutiliza `/health-centers`.
- Ubigeo: vista de solo lectura / ocultar distrito; no CRUD libre de códigos INEI.

### 9.2 Cableado de selects

| UI | Fuente |
| --- | --- |
| Estadio, educación, seguro, EPS, zona, SEPA, barreras, situación tx, … | `GET /catalogs?kind=` |
| Diagnóstico / especialidad / lengua / fuente ingreso | idem |
| Departamento / provincia / distrito | `GET /catalogs/ubigeo` |
| Hospital / centro | `GET /health-centers` |
| Roles, estados de follow-up, etc. | OpenAPI enums (sin config) |

Al enviar formularios, el front manda el `code` (o el string label de
diagnóstico si se elige mantener compatibilidad: preferir `code` estable
para kinds system y `label` o `code` slug para diagnósticos abiertos).

Recomendación marcha blanca: para `cancer_diagnosis` y `medical_specialty`
usar `label` como valor persistido (igual que hoy el texto libre) hasta
Fase 5; el catálogo solo alimenta el dropdown.

## 10. Fuera de alcance (primer PR / marcha blanca)

- UI de configuración en este repo.
- Migrar columnas a FK.
- Pacientes, agentes o datos demo en staging.
- Edición libre de códigos ubigeo INEI.
- Hacer configurables roles y estados de flujo.

## 11. Checklist de aceptación backend

- [ ] `npm run seed:staging` deja solo admin + system volunteer + hospitales + catálogos + ubigeo.
- [ ] Truncate no rompe `gemini` ni migraciones.
- [ ] `GET /catalogs?kind=cancer_stage` devuelve estadios con labels ES.
- [ ] `GET /catalogs/ubigeo?department=LIMA` incluye provincia Lima y distritos.
- [ ] Admin puede crear/archivar un ítem no-system; no puede archivar system.
- [ ] OpenAPI actualizado.
- [ ] `DEPLOY.md` documenta el reset de staging.
