# Spec: Archivos de pacientes con Cloudflare R2

- Estado: Propuesto
- Fecha: 2026-08-27
- Alcance: backend NestJS, contrato OpenAPI y frontend FPC
- Primera versión: MVP

## 1. Contexto

Los agentes del Call Center necesitan poder incorporar al sistema archivos
relacionados con la atención de un paciente. Los archivos pueden ser informes
médicos, exámenes, recetas u otros documentos entregados durante el tratamiento.

Actualmente el sistema solo almacena indicadores como `hasMedicalReport` y
`hasLatestPrescription`; no almacena el archivo, no tiene una entidad de
documentos y no cuenta con una integración de almacenamiento binario.

El contenido se almacenará en **Cloudflare R2** porque la aplicación ya utiliza
Cloudflare como capa perimetral y R2 ofrece almacenamiento compatible con la API
S3, con una cuota gratuita amplia. La aplicación no utilizará servicios de AWS ni
un bucket público. Si se utiliza un cliente compatible con la API S3, será
únicamente un detalle técnico del adaptador de R2.

## 2. Objetivos

1. Permitir que personal autorizado cargue un archivo y lo asigne a un paciente.
2. Permitir asociar el archivo a un diagnóstico o a un tratamiento concreto.
3. Permitir archivos generales del paciente con una descripción.
4. Persistir los metadatos en PostgreSQL y el contenido en Cloudflare R2.
5. Permitir previsualizar imágenes y PDF, y descargar cualquier formato
   soportado.
6. Mantener el bucket privado y validar permisos en el backend en cada operación.
7. Conservar una auditoría mínima de quién cargó y quién archivó cada archivo.

## 3. Alcance del MVP

### Incluido

- Nueva pestaña `Documentos` en la ficha del paciente.
- Carga de un archivo por solicitud.
- Tamaño máximo de 10 MiB, equivalente a `10_485_760` bytes.
- Formatos PDF, DOC, DOCX, JPG, PNG y WEBP.
- Clasificación en `MEDICAL_REPORT`, `PRESCRIPTION` y `OTHER`.
- Asociación exclusiva a un diagnóstico, a un tratamiento o directamente al
  paciente.
- Descripción para documentos generales.
- Listado de documentos activos, con filtros y paginación.
- Previsualización autenticada de imágenes y PDF.
- Descarga autenticada de todos los formatos soportados.
- Archivado lógico con usuario y fecha.
- Buckets R2 separados para staging y producción.
- Pruebas unitarias, e2e y frontend.

### Fuera del alcance

- Carga de archivos durante el enrolamiento.
- Carga de archivos dentro de la creación de seguimientos, diagnósticos o
  tratamientos.
- Carga múltiple o cola de archivos.
- Reemplazo o edición del contenido de un archivo ya cargado.
- Restauración de un archivo archivado.
- Acceso de voluntarios a documentos.
- URLs públicas o URLs firmadas entregadas al navegador.
- OCR, extracción de texto o inclusión del contenido en resúmenes de IA.
- Escaneo antivirus o análisis antimalware.
- Registro detallado de cada visualización o descarga.
- Eliminación física inmediata del objeto de R2.

El escaneo antimalware debe registrarse como requisito de una fase posterior. La
validación de extensión, MIME, firma binaria, tamaño y estructura básica del
archivo sí es obligatoria en el MVP.

## 4. Decisiones funcionales

### 4.1 Tipos documentales

| Tipo API | Etiqueta UI | Asociación requerida | Descripción |
| --- | --- | --- | --- |
| `MEDICAL_REPORT` | Informe médico | `diagnosisId` obligatorio | Opcional |
| `PRESCRIPTION` | Receta | `treatmentId` obligatorio | Opcional |
| `OTHER` | Otro | Ninguna | Obligatoria |

Reglas:

- Cada archivo pertenece siempre a un paciente.
- Un archivo puede tener como máximo una asociación clínica.
- `MEDICAL_REPORT` no puede recibir `treatmentId`.
- `PRESCRIPTION` no puede recibir `diagnosisId`.
- `OTHER` no puede recibir `diagnosisId` ni `treatmentId`.
- El diagnóstico o tratamiento asociado debe pertenecer al paciente indicado en
  la URL.
- Una receta se asocia a la versión exacta del tratamiento seleccionada, no al
  `seriesId` lógico del tratamiento.
- Un informe se asocia a la versión exacta del diagnóstico seleccionada.
- Las asociaciones a registros históricos no se relinkean automáticamente si
  luego se crea una nueva versión clínica.
- `hasMedicalReport` y `hasLatestPrescription` continúan siendo campos
  independientes durante el MVP. No se derivan automáticamente de la
  existencia de archivos.

### 4.2 Descripción y nombre

- El nombre original se conserva como metadato de presentación.
- El nombre original no se utiliza como clave de R2.
- Para `OTHER`, la descripción debe contener al menos un carácter no blanco y
  tener como máximo 1000 caracteres.
- Para los otros tipos, la descripción es opcional y tiene el mismo límite.
- Se eliminan caracteres de control y separadores de ruta del nombre al
  persistirlo y al construir `Content-Disposition`.
- El nombre nunca se inserta en SQL, logs estructurados ni claves de objeto sin
  el tratamiento correspondiente.

### 4.3 Archivado

El archivado es lógico:

- Se registra `archivedAt` y `archivedById`.
- El documento deja de aparecer en el listado normal.
- El endpoint de contenido rechaza documentos archivados.
- El objeto de R2 no se elimina durante el MVP.
- No existe restauración en el MVP.
- El archivado es idempotente; repetir la operación no cambia el primer usuario
  ni la primera fecha de archivado.

Conservar el objeto permite mantener la trazabilidad y evita que una operación
de negocio dependa de que la eliminación remota termine correctamente. La
política legal de retención y una eventual eliminación física son decisiones
posteriores.

## 5. Arquitectura

```text
Navegador
   |
   | HTTPS + sesión/JWT
   v
API NestJS
   |                         \
   | metadatos y permisos      \ contenido binario
   v                            v
PostgreSQL                 Cloudflare R2 privado
```

### Principios

1. El navegador solo se comunica con la API.
2. Las credenciales de R2 existen únicamente en el backend.
3. La API autoriza el paciente, el rol y la asociación antes de leer o escribir.
4. El bucket no es público y no se configura un dominio público para los
   objetos.
5. PostgreSQL es la fuente de verdad de existencia, estado y asociaciones.
6. El almacenamiento se abstrae detrás de una interfaz para poder usar un fake
   en pruebas sin conectarse a R2.
7. La solución no depende del sistema de archivos local del contenedor, porque
   los contenedores de Dokploy son reemplazables y no tienen un volumen de
   archivos persistente.

### Adaptador de almacenamiento

Crear un puerto similar a:

```ts
interface PatientDocumentStorage {
  put(input: {
    key: string;
    body: Buffer;
    contentType: string;
    contentLength: number;
  }): Promise<void>;

  get(key: string): Promise<{
    body: NodeJS.ReadableStream;
    contentLength?: number;
    contentType?: string;
  }>;

  delete(key: string): Promise<void>;
}
```

La implementación de producción utilizará Cloudflare R2 mediante su endpoint
compatible con S3. `@aws-sdk/client-s3` puede utilizarse como cliente de
protocolo si resulta la opción más estable para el proyecto, pero no se creará
ni administrará ningún recurso de AWS.

El adaptador no debe exponer métodos que entreguen URLs públicas. Si en el
futuro se necesitan URLs firmadas, deberán ser emitidas por la API después de
validar el acceso y tener una expiración corta.

## 6. Cloudflare R2

### 6.1 Buckets

Se utilizarán exactamente dos buckets, separados por entorno:

| Entorno | Uso |
| --- | --- |
| Staging | Desarrollo compartido y validación en Dokploy |
| Producción | Datos reales de pacientes |

Los nombres concretos se configurarán fuera del código, por ejemplo:

- `fpc-patient-documents-staging`
- `fpc-patient-documents-production`

No se deben reutilizar credenciales ni el bucket de producción en staging.

El desarrollo local puede usar el fake de almacenamiento para tests. Una prueba
manual contra R2 debe apuntar explícitamente al bucket de staging y nunca debe
tener credenciales de producción.

### 6.2 Configuración

Variables de entorno del backend:

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | Sí | ID de la cuenta Cloudflare |
| `R2_ACCESS_KEY_ID` | Sí | Token de acceso R2 del entorno |
| `R2_SECRET_ACCESS_KEY` | Sí | Secreto del token R2 |
| `R2_BUCKET_NAME` | Sí | Bucket del entorno actual |
| `R2_ENDPOINT` | No | Endpoint completo; por defecto se deriva de `R2_ACCOUNT_ID` |
| `PATIENT_DOCUMENT_MAX_BYTES` | No | Default `10485760` |

Endpoint derivado:

```text
https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
```

Parámetros del cliente:

- Región: `auto`.
- Endpoint: `R2_ENDPOINT` o el endpoint derivado.
- Credenciales: las variables anteriores.
- Bucket: `R2_BUCKET_NAME`.
- Clave generada por el backend.

El validador de entorno debe exigir las variables R2 cuando el driver de
documentos esté habilitado. No debe existir un fallback silencioso a disco local
en staging o producción.

Las credenciales se crearán como tokens R2 con el mínimo alcance posible,
limitados al bucket del entorno. Se configurarán como secretos en cada aplicación
de Dokploy y nunca se subirán al repositorio, al frontend, a `openapi.json` ni a
los logs.

### 6.3 Claves de objetos

La clave no debe contener DNI, nombre, nombre de archivo ni texto controlado por
el usuario. Se recomienda:

```text
patient-documents/<documentId>
```

`documentId` es un UUID generado por el backend. La extensión original no se
agrega a la clave; el MIME validado se conserva en PostgreSQL y en los metadatos
del objeto.

### 6.4 Perímetro y privacidad

Cloudflare WAF y el firewall de la web protegen las solicitudes que llegan a la
API, pero no reemplazan la autorización del dominio. La API debe continuar
validando rol, paciente y documento aunque la solicitud llegue desde una red
confiable.

El endpoint de R2 no se expone al navegador en el MVP. No se requiere CORS de R2
para este flujo. El backend hará el proxy autenticado del contenido.

## 7. Modelo de datos

### 7.1 Entidad `PatientDocument`

Archivo sugerido:

```text
src/database/entities/patient-document.entity.ts
```

Tabla: `patient_documents`.

| Columna | Tipo | Null | Regla |
| --- | --- | --- | --- |
| `id` | UUID | No | PK, generado por la aplicación o la base |
| `patient_id` | UUID | No | FK a `patients.id` |
| `document_type` | VARCHAR(32) | No | `MEDICAL_REPORT`, `PRESCRIPTION`, `OTHER` |
| `diagnosis_id` | UUID | Sí | FK a `patient_diagnoses.id` |
| `treatment_id` | UUID | Sí | FK a `patient_treatments.id` |
| `description` | TEXT | Sí | Obligatoria para `OTHER` |
| `original_file_name` | VARCHAR(255) | No | Nombre seguro para presentación |
| `media_type` | VARCHAR(127) | No | MIME detectado por el servidor |
| `size_bytes` | INTEGER | No | Mayor que cero y menor o igual a 10485760 |
| `sha256` | CHAR(64) | No | Hash calculado sobre los bytes recibidos |
| `storage_key` | VARCHAR(512) | No | Única, no pública |
| `status` | VARCHAR(16) | No | `PENDING`, `ACTIVE`, `ARCHIVED` |
| `uploaded_by_id` | UUID | No | FK a `users.id` |
| `created_at` | TIMESTAMPTZ | No | Fecha de carga |
| `archived_at` | TIMESTAMPTZ | Sí | Fecha del archivado |
| `archived_by_id` | UUID | Sí | Usuario que archivó |

`PENDING` es un estado técnico que no se devuelve en listados ni permite
descarga. Se utiliza para manejar la coordinación entre PostgreSQL y R2. El
estado pasa a `ACTIVE` solo después de confirmar que el objeto fue escrito en
R2.

### 7.2 Restricciones

La migración debe crear una restricción equivalente a:

```sql
CHECK (
  (document_type = 'MEDICAL_REPORT'
    AND diagnosis_id IS NOT NULL
    AND treatment_id IS NULL)
  OR
  (document_type = 'PRESCRIPTION'
    AND diagnosis_id IS NULL
    AND treatment_id IS NOT NULL)
  OR
  (document_type = 'OTHER'
    AND diagnosis_id IS NULL
    AND treatment_id IS NULL
    AND char_length(btrim(description)) > 0)
)
```

Otras restricciones:

- `size_bytes > 0`.
- `size_bytes <= 10485760` en el MVP.
- `sha256` debe tener 64 caracteres hexadecimales.
- `storage_key` debe ser única.
- `archived_at` y `archived_by_id` deben estar ambos definidos o ambos vacíos.
- Un documento archivado debe tener estado `ARCHIVED`.
- Un documento `ACTIVE` no puede tener campos de archivado.

La validación de que la asociación pertenece al mismo paciente se realiza en el
servicio dentro de la misma operación de negocio. No se confía únicamente en
que el frontend haya enviado IDs válidos.

### 7.3 Relaciones e índices

Foreign keys sugeridas:

- `patient_id -> patients.id` con `RESTRICT` o comportamiento equivalente.
- `diagnosis_id -> patient_diagnoses.id` con `RESTRICT`.
- `treatment_id -> patient_treatments.id` con `RESTRICT`.
- `uploaded_by_id -> users.id` con `RESTRICT`.
- `archived_by_id -> users.id` nullable, con `SET NULL` si la política de
  usuarios lo requiere.

Índices sugeridos:

- Índice único sobre `storage_key`.
- `(patient_id, created_at DESC, id DESC)` para el listado activo.
- `diagnosis_id`.
- `treatment_id`.
- `document_type`.
- `uploaded_by_id`.
- `status` o índice parcial para registros `PENDING` antiguos.

La migración debe ser posterior a la última migración existente y debe agregarse
`patient_documents` al reset de tablas del seed demo. Si las pruebas borran
pacientes físicamente, deben borrar o truncar primero sus documentos, respetando
las foreign keys.

## 8. Ciclo de carga y consistencia

No existe una transacción ACID compartida entre PostgreSQL y R2. El servicio debe
garantizar que nunca se devuelva éxito mientras el documento no esté disponible
en ambos sistemas.

Flujo requerido:

1. El guard de autenticación y el guard de roles validan la sesión y el rol.
2. Multer acepta exactamente un archivo y aplica el límite de tamaño antes de
   entregar el buffer al servicio.
3. El servicio valida el paciente y exige que sea un registro con rol `PATIENT`.
4. El servicio normaliza los campos multipart, valida el tipo documental y
   comprueba la asociación clínica.
5. El servidor valida bytes, MIME, extensión, estructura básica y tamaño; luego
   calcula `sha256`.
6. Se genera `documentId` y `storageKey`.
7. Se inserta un registro `PENDING` en PostgreSQL.
8. Se escribe el buffer en R2 con el MIME validado.
9. Se actualiza el registro a `ACTIVE` dentro de una transacción corta.
10. Se devuelve el documento activo sin `storageKey` ni contenido binario.

En caso de error:

- Si R2 falla, el registro `PENDING` se elimina o se marca para limpieza y la
  API devuelve un error sin éxito parcial.
- Si falla la actualización a `ACTIVE`, se intenta eliminar el objeto de R2 y se
  registra el incidente sin incluir el contenido ni secretos.
- Un proceso de reconciliación debe eliminar registros `PENDING` que superen un
  TTL operativo y sus objetos asociados. El proceso puede comenzar como una
  tarea programada o un comando administrativo.
- Si falla una eliminación compensatoria, el error debe quedar observable para
  reintento; no se debe ignorar silenciosamente.

El servicio puede usar un buffer en memoria porque el límite es de 10 MiB, pero
debe aplicar límites de archivo y de cantidad antes de aceptar el contenido. No
se permite `memoryStorage` sin `limits.fileSize` y `limits.files`.

## 9. Validación de archivos

### 9.1 Tipos permitidos

| Extensión | MIME esperado | Validación mínima |
| --- | --- | --- |
| `.pdf` | `application/pdf` | Firma `%PDF-` y estructura legible |
| `.doc` | `application/msword` | Firma OLE Compound File |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Contenedor ZIP Office válido |
| `.jpg`, `.jpeg` | `image/jpeg` | Firma JPEG |
| `.png` | `image/png` | Firma PNG |
| `.webp` | `image/webp` | Cabecera RIFF/WEBP |

El MIME enviado por el cliente es informativo y no es fuente de verdad. El
backend debe comparar extensión, MIME esperado y bytes detectados. Si no
coinciden, rechaza la solicitud.

No se aceptan SVG, HTML, ejecutables, ZIP genéricos, `.docm` ni otros formatos
Office habilitados para macros. Si el análisis estructural de un `.docx` detecta
un proyecto VBA embebido, debe rechazarse.

### 9.2 Límites y nombres

- Un archivo por request.
- Tamaño mínimo: mayor que cero.
- Tamaño máximo: 10 MiB.
- Descripción máxima: 1000 caracteres.
- Nombre original máximo: 255 caracteres después de normalizarlo.
- Rechazar nombres vacíos, rutas (`/`, `\\`), caracteres de control y valores
  que no puedan representarse de forma segura en `Content-Disposition`.
- El frontend debe enviar `accept` con los formatos permitidos, pero la
  validación definitiva siempre ocurre en el backend.

No se implementa antivirus en esta fase. La ausencia de antivirus debe aparecer
en la documentación operativa y en el registro de riesgos del producto.

## 10. Contrato HTTP

Prefijo: ninguno. Las rutas se sirven directamente bajo `/patients`.

Todas las rutas requieren autenticación Bearer y los roles `ADMIN`, `FOUNDATION`
o `AGENT`.

### 10.1 Cargar documento

```http
POST /patients/{patientId}/documents
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

Campos multipart:

| Campo | Tipo | Requerido |
| --- | --- | --- |
| `file` | binary | Sí |
| `documentType` | enum | Sí |
| `diagnosisId` | UUID | Solo para `MEDICAL_REPORT` |
| `treatmentId` | UUID | Solo para `PRESCRIPTION` |
| `description` | string | Solo para `OTHER`; opcional en los demás |

Respuesta `201`:

```json
{
  "id": "uuid",
  "patientId": "uuid",
  "documentType": "MEDICAL_REPORT",
  "diagnosisId": "uuid",
  "treatmentId": null,
  "description": "Informe anatomopatológico",
  "originalFileName": "informe.pdf",
  "mediaType": "application/pdf",
  "sizeBytes": 123456,
  "sha256": "hexadecimal",
  "status": "ACTIVE",
  "uploadedById": "uuid",
  "createdAt": "2026-08-27T12:00:00.000Z",
  "archivedAt": null,
  "archivedById": null
}
```

`storageKey` y cualquier credencial o URL interna de R2 quedan excluidos de la
respuesta.

### 10.2 Listar documentos

```http
GET /patients/{patientId}/documents
  ?documentType=MEDICAL_REPORT
  &diagnosisId=<uuid>
  &treatmentId=<uuid>
  &includeArchived=false
  &limit=50
  &offset=0
Authorization: Bearer <token>
```

Parámetros:

- `documentType`: opcional.
- `diagnosisId`: opcional; no puede combinarse con `treatmentId`.
- `treatmentId`: opcional; no puede combinarse con `diagnosisId`.
- `includeArchived`: default `false`.
- `limit`: default `50`, máximo `100`.
- `offset`: default `0`, mínimo `0`.

La respuesta es:

```json
{
  "data": [],
  "total": 0,
  "limit": 50,
  "offset": 0
}
```

El listado normal devuelve únicamente documentos `ACTIVE`. Cuando
`includeArchived=true`, puede devolver también metadatos `ARCHIVED` para
consulta de auditoría, pero nunca documentos `PENDING` ni contenido binario.

El orden estable es `createdAt DESC, id DESC`.

### 10.3 Obtener contenido

```http
GET /patients/{patientId}/documents/{documentId}/content
Authorization: Bearer <token>
```

La API:

1. Verifica el rol.
2. Busca el documento limitado por `documentId` y `patientId`.
3. Rechaza cualquier estado distinto de `ACTIVE`.
4. Obtiene el objeto de R2 usando `storageKey` interno.
5. Devuelve el stream sin cargar una segunda copia completa innecesaria.

Headers mínimos:

```http
Content-Type: <MIME validado>
Content-Length: <tamaño>
Content-Disposition: inline; filename*=UTF-8''<nombre-seguro>
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
```

El frontend puede convertir la respuesta en un `Blob` y crear un enlace de
descarga con el nombre original. Para previsualización, imágenes y PDF se
renderizan desde el `Blob`; DOC y DOCX se descargan.

Un documento archivado responde `410 Gone`. Un ID que no pertenece al paciente
de la ruta responde `404 Not Found`, sin revelar documentos de otro paciente.

### 10.4 Archivar documento

```http
PATCH /patients/{patientId}/documents/{documentId}/archive
Authorization: Bearer <token>
```

No requiere body. Devuelve `200` con la representación actualizada del documento.
La operación es idempotente y conserva el primer `archivedAt` y `archivedById`.

No se agrega `DELETE` físico en el MVP.

### 10.5 Errores

| Código | Situación |
| --- | --- |
| `400` | Multipart incompleto, UUID inválido, tipo o asociación inválida |
| `401` | Sesión ausente o inválida |
| `403` | Rol no autorizado |
| `404` | Paciente, documento o asociación no encontrada |
| `409` | El registro indicado no es un paciente o existe conflicto de asociación |
| `410` | Documento archivado o no disponible |
| `413` | Archivo mayor al límite |
| `415` | MIME, extensión o firma no soportados |
| `500` | Falla inesperada de base o R2 |
| `503` | Almacenamiento temporalmente no disponible, si se distingue de `500` |

Los mensajes no deben incluir claves R2, credenciales, stack traces ni contenido
del archivo.

## 11. Autorización y privacidad

### Matriz del MVP

| Acción | ADMIN | FOUNDATION | AGENT | VOLUNTEER |
| --- | --- | --- | --- | --- |
| Listar | Sí | Sí | Sí | No |
| Previsualizar/descargar | Sí | Sí | Sí | No |
| Cargar | Sí | Sí | Sí | No |
| Archivar | Sí | Sí | Sí | No |

La autorización debe existir en dos niveles:

- Decorador `@Roles(...)` en el controlador.
- Validación en el servicio de que el paciente y el documento corresponden a la
  solicitud.

Los documentos se limitan a pacientes con `PatientRole.PATIENT`. Los registros
  `COMPANION` no pueden recibir documentos mediante este módulo en el MVP.

No se debe reutilizar una URL de descarga previamente autorizada, porque el MVP
no entrega URLs de R2. Cada lectura pasa por la API y vuelve a validar el acceso.

El documento no se agrega al payload de resúmenes de IA, a n8n ni al timeline.
No se escribe contenido binario en logs. El nombre de archivo puede contener
información sensible y debe evitarse en logs salvo que sea estrictamente
necesario para diagnóstico, con redacción apropiada.

## 12. Integración con el frontend

### 12.1 Navegación

Extender:

```text
src/pages/pacientes/[id]/_lib/patient-tabs.ts
src/pages/pacientes/[id]/_components/patient-detail-content.tsx
```

La URL será:

```text
/pacientes/:patientId?tab=documentos
```

No se crea una ruta anidada adicional. Esto conserva breadcrumbs, navegación y
preservación de parámetros existentes.

La pestaña se muestra solo para usuarios `ADMIN`, `FOUNDATION` o `AGENT` y para
registros cuyo rol de paciente sea `PATIENT`. El backend sigue siendo la fuente
de verdad de los permisos.

### 12.2 Componentes y hooks sugeridos

```text
src/api/patient-documents.ts
src/pages/pacientes/[id]/_hooks/use-patient-documents.ts
src/pages/pacientes/[id]/_components/patient-documents-tab.tsx
src/pages/pacientes/[id]/_components/patient-document-upload-dialog.tsx
src/pages/pacientes/[id]/_components/patient-document-preview-dialog.tsx
```

La API frontend debe:

- Exponer tipos derivados del contrato OpenAPI.
- Enviar el multipart sin convertir el archivo a Base64.
- Reutilizar la autenticación existente.
- Resolver el listado con una query key como
  `['patient-documents', patientId, filters]`.
- Invalidar la lista después de una carga o archivado exitoso.
- Descargar el contenido con una solicitud autenticada, no mediante un `<a
  href>` directo que omita el Bearer token.

### 12.3 Formulario de carga

El diálogo debe incluir:

- Selector de archivo.
- Selector de tipo documental.
- Selector de diagnóstico cuando el tipo es `MEDICAL_REPORT`.
- Selector de tratamiento cuando el tipo es `PRESCRIPTION`.
- Descripción condicional, obligatoria para `OTHER`.
- Nombre y tamaño del archivo seleccionado.
- Mensajes de error para formato, tamaño, asociación y fallos de red.
- Estado de envío que evita solicitudes duplicadas.

El selector de diagnóstico debe mostrar una etiqueta legible y enviar el ID. El
selector de tratamiento debe hacer lo mismo. Debido a la regla del repositorio,
ambos deben pasar `items` al `<Select>` raíz con objetos `{ value, label }`; no se
debe confiar únicamente en los `<SelectItem>` del contenido.

El frontend puede validar anticipadamente extensión y tamaño para mejorar la
experiencia, pero no debe asumir que esa validación reemplaza al backend.

### 12.4 Listado y previsualización

Cada elemento debe mostrar como mínimo:

- Tipo documental.
- Nombre original.
- Descripción si existe.
- Asociación clínica con etiqueta legible, si existe.
- Tamaño.
- Fecha de carga.
- Usuario que cargó.
- Estado archivado cuando se consulta el historial.
- Acciones permitidas.

Reglas de visualización:

- Imágenes: mostrar preview autenticado.
- PDF: mostrar preview autenticado mediante `iframe`, `embed` o equivalente,
  controlando la limpieza del `Blob`.
- DOC/DOCX: mostrar metadatos y ofrecer descarga.
- Todos los formatos: ofrecer descarga explícita.
- Revocar cada `URL.createObjectURL` al cerrar el preview o cambiar de archivo.
- Mostrar estados de carga, error, vacío y archivo archivado.
- Mantener controles utilizables en móvil y con etiquetas accesibles.

## 13. OpenAPI y archivos generados

El contrato se genera desde los controladores Nest y se persiste en:

```text
fpc-backend/openapi/openapi.json
```

La implementación debe:

1. Agregar los DTOs de documentos.
2. Decorar la carga con `@ApiConsumes('multipart/form-data')` y un `@ApiBody`
   cuyo campo `file` sea `type: string, format: binary`.
3. Declarar la respuesta binaria del endpoint de contenido.
4. Registrar el nuevo controlador y provider fake en
   `src/openapi/openapi.module.ts`, porque la generación utiliza un módulo
   separado de `AppModule`.
5. Ejecutar `npm run openapi:generate` y verificar `npm run openapi:check`.
6. Ejecutar `npm run api:generate` en `fpc-front` después de actualizar el
   contrato.

El contrato no debe contener secretos, endpoints privados de R2 ni URLs públicas
de objetos.

## 14. Organización backend sugerida

```text
src/database/entities/patient-document.entity.ts
src/database/migrations/<timestamp>-AddPatientDocuments.ts
src/modules/patients/documents/patient-documents.controller.ts
src/modules/patients/documents/patient-documents.service.ts
src/modules/patients/documents/dto/create-patient-document.dto.ts
src/modules/patients/documents/dto/list-patient-documents.dto.ts
src/modules/patients/documents/dto/patient-document-response.dto.ts
src/integrations/storage/patient-document-storage.ts
src/integrations/storage/cloudflare-r2-patient-document-storage.service.ts
src/integrations/storage/patient-document-storage.module.ts
```

El módulo de documentos puede registrarse dentro de `PatientsModule`, siguiendo
el patrón actual de subrecursos de pacientes. El adaptador de almacenamiento debe
ser un provider inyectable y reemplazable en tests.

También deben actualizarse, según corresponda:

- `src/config/env.validation.ts`.
- `.env.example`.
- `compose.local.yml` solo para variables de desarrollo, sin secretos reales.
- `src/database/seeds/demo/reset.ts`.
- `DEPLOY.md` con las variables R2 de Dokploy.
- `src/openapi/openapi.module.ts`.

No se agrega un volumen de archivos al Docker Compose ni al contenedor de
producción. El volumen persistente del contenido es R2.

## 15. Pruebas

### 15.1 Unitarias backend

Crear pruebas junto al servicio de documentos para cubrir:

- Guarda `uploadedById` del usuario autenticado.
- Rechaza roles no autorizados en el controlador o servicio.
- Rechaza `COMPANION`.
- Rechaza diagnóstico de otro paciente.
- Rechaza tratamiento de otro paciente.
- Rechaza ambos vínculos a la vez.
- Rechaza vínculo incompatible con `documentType`.
- Rechaza `OTHER` sin descripción válida.
- Permite un documento paciente-level válido.
- Persiste MIME detectado, tamaño y hash del contenido.
- No expone `storageKey` en el DTO.
- No lista `PENDING` ni `ARCHIVED` por defecto.
- Ejecuta `assertPatientRole` antes de cargar.
- Ejecuta autorización antes de listar, leer o archivar.
- Elimina o marca para limpieza el objeto si falla la persistencia final.
- Archiva conservando el primer usuario y fecha.
- Rechaza contenido de un documento archivado.

El fake de R2 debe poder simular éxito, fallo de carga, fallo de lectura, fallo
de eliminación y objeto inexistente.

### 15.2 E2E backend

Crear una suite de documentos que cubra:

- Multipart válido con PDF, imagen, DOC y DOCX.
- Respuesta `201` con metadatos correctos.
- Listado, filtros, paginación y orden estable.
- Descarga con bytes exactos y headers de seguridad.
- Preview de PDF e imagen mediante el mismo endpoint.
- Archivado y posterior `410` del contenido.
- Archivo ausente.
- Archivo mayor a 10 MiB.
- Extensión, MIME y firma incompatibles.
- Solicitud sin archivo.
- Asociación a diagnóstico válido.
- Asociación a tratamiento válido.
- Asociación cruzada entre pacientes.
- Combinación diagnosis/treatment inválida.
- Agente, Fundación y administrador con acceso.
- Voluntario sin acceso.
- Paciente no encontrado y companion rechazado.
- ID de documento perteneciente a otro paciente devuelve `404`.
- Solicitud no autenticada rechazada antes de procesar el archivo.

Las pruebas e2e deben utilizar el adaptador fake o una configuración de test
aislada. No deben subir datos al bucket real de staging salvo una prueba de
integración explícita y separada.

### 15.3 Frontend

Cubrir:

- La pestaña y URL `tab=documentos`.
- Visibilidad por rol y tipo de registro.
- Validación de tamaño y extensiones.
- Campos condicionales según tipo documental.
- Labels de diagnóstico y tratamiento en los `Select` antes de abrirlos.
- Carga exitosa y actualización del listado.
- Error de carga sin perder el formulario innecesariamente.
- Preview de imagen y PDF.
- Descarga de DOC/DOCX.
- Archivado y actualización del estado.
- Limpieza de object URLs.
- Estados vacío, loading, error y móvil.

## 16. Despliegue

### Staging en Dokploy

- Configurar credenciales de un token R2 limitado al bucket de staging.
- Configurar `R2_BUCKET_NAME` con el bucket de staging.
- Aplicar la migración antes de usar la pestaña.
- Probar carga, preview, descarga y archivado con datos no productivos.

### Producción en Dokploy

- Configurar credenciales independientes y limitadas al bucket de producción.
- Configurar `R2_BUCKET_NAME` con el bucket de producción.
- Aplicar la migración una sola vez y de forma serializada.
- Verificar que el bucket sea privado y que no exista una ruta pública para
  objetos.
- Validar health check, carga y descarga después del despliegue.

Los secretos se administran en Dokploy, no en GitHub ni en los archivos `.env`
versionados. El despliegue no debe ejecutar dos migraciones concurrentes desde
varias réplicas.

R2 y PostgreSQL tienen ciclos de backup y retención distintos. El procedimiento
operativo debe documentar cómo recuperar ambos componentes; el backup de
PostgreSQL por sí solo no recupera los binarios de R2.

## 17. Criterios de aceptación

### Carga

- Dado un usuario `AGENT`, `FOUNDATION` o `ADMIN` y un paciente válido, cuando
  carga un PDF permitido con metadatos válidos, se crea un registro activo y el
  contenido queda disponible en el bucket R2 del entorno.
- Dado un archivo de más de 10 MiB, la API responde `413` y no crea un documento
  activo ni deja un objeto utilizable en R2.
- Dado un archivo con extensión permitida pero firma incompatible, la API lo
  rechaza y no lo deja disponible.

### Asociación

- Un informe médico solo se puede crear con un diagnóstico del mismo paciente.
- Una receta solo se puede crear con un tratamiento del mismo paciente.
- Un documento `OTHER` solo se puede crear sin vínculo clínico y con descripción
  válida.
- Ninguna combinación inválida puede crearse manipulando directamente la
  solicitud HTTP.

### Consulta

- Un usuario autorizado puede listar los documentos activos de un paciente.
- Puede previsualizar imágenes y PDF sin exponer R2 directamente al navegador.
- Puede descargar DOC y DOCX mediante una solicitud autenticada.
- Un voluntario no puede listar ni obtener contenido aunque conozca los IDs.
- Un documento de otro paciente nunca se devuelve por una combinación de IDs.

### Archivado

- Al archivar, el documento deja de aparecer en el listado normal.
- Su contenido deja de estar disponible inmediatamente.
- Se conservan usuario y fecha del primer archivado.
- El objeto permanece en R2 durante el MVP.

### Operación

- Las credenciales de R2 no aparecen en frontend, OpenAPI, logs ni respuestas.
- El sistema funciona en staging y producción con buckets independientes.
- Los tests no requieren acceso de red a R2.
- La migración, el contrato OpenAPI y el cliente frontend quedan sincronizados.

## 18. Riesgos y evolución posterior

1. **Antimalware:** DOC/DOCX y PDFs pueden contener contenido malicioso. Se debe
   incorporar cuarentena y escaneo antes de permitir descarga en una fase
   posterior.
2. **Ancho de banda:** el proxy de contenido consume recursos de la API. Si el
   volumen crece, evaluar URLs firmadas de corta duración emitidas después de
   autorizar.
3. **Consistencia R2/PostgreSQL:** se requiere reconciliación de registros
   `PENDING` y objetos huérfanos.
4. **Retención:** archivar no equivale a eliminar. La política de retención
   clínica y legal debe definir cuándo se puede borrar físicamente.
5. **Historial clínico:** asociaciones a IDs versionados pueden no aparecer como
   parte del registro actual. El listado patient-level evita perder visibilidad;
   una vista por `seriesId` puede evaluarse después.
6. **Auditoría de acceso:** el MVP registra carga y archivado, pero no cada
   descarga o visualización. Esto puede requerir una tabla de eventos posterior.
7. **Voluntarios:** si se necesita acceso futuro, debe revisarse la regla actual
   de asignación histórica y la sensibilidad de informes antes de ampliar roles.
8. **Archivos grandes:** si el límite aumenta, reemplazar el buffer multipart por
   carga por partes o un flujo de upload directo con URLs firmadas y confirmación
   de metadatos.

## 19. Orden de implementación

1. Confirmar el nombre de buckets, tokens R2 y políticas de privacidad.
2. Agregar configuración, validación de entorno y adaptador R2/fake.
3. Crear entidad, migración, restricciones e índices.
4. Crear DTOs, servicio, controlador y autorización.
5. Implementar compensación y reconciliación de estados `PENDING`.
6. Agregar pruebas unitarias y e2e del backend.
7. Registrar el controlador en el módulo especial de OpenAPI.
8. Regenerar y verificar `openapi/openapi.json`.
9. Regenerar los tipos del frontend.
10. Agregar API frontend, tab, formulario, listado, preview y archivado.
11. Agregar pruebas frontend.
12. Actualizar variables de entorno, `DEPLOY.md` y reset del seed.
13. Ejecutar build, lint, tests, migraciones de staging y prueba manual.

La implementación no debe empezar por la UI: el contrato, la persistencia y la
autorización del backend son prerrequisitos para evitar una pantalla que no
pueda guardar de forma segura los archivos clínicos.
