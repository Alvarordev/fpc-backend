# Biblioteca y asistente documental

El asistente comparte conversaciones, permisos y registro con el asistente de
datos, pero cada conversación tiene un modo inmutable: `DATA` o `DOCUMENTS`.
Los agentes solo usan `DOCUMENTS`; administración y fundación usan ambos.
El cambio de modo en el frontend conserva conversaciones y borradores separados.

## Biblioteca

ADMIN y FOUNDATION gestionan `/knowledge/documents`:

- `GET`: lista paginada (`search`, `status`, `limit`, `offset`).
- `POST`: carga multipart con `file`, `title` y `version` (por defecto `1`).
- `POST /:id/publish`: publica un archivo preparado.
- `POST /:id/archive`: lo retira de las búsquedas nuevas.
- `POST /:id/retry`: reintenta una preparación fallida.
- `DELETE /:id`: elimina un archivo no publicado y su índice remoto.
- `GET /:id/content`: descarga autenticada del original. Los agentes solo pueden
  descargar documentos publicados. Los administradores pueden descargar borradores.

`GET /knowledge/status` ofrece el número de documentos publicados a los tres roles.
Los originales PDF y Word `.docx` (hasta 10 MB) se guardan en PostgreSQL, con
contenido binario excluido de las consultas de listado. Los respaldos de la base
deben incluir estos archivos; tenerlos en memoria no es suficiente.

La carga valida extensión y firma; Word también debe contener `word/document.xml`.
El documento nace como borrador y requiere publicación explícita. Actualizar una
versión implica subir el archivo nuevo y retirar el anterior. Se conservan autor
de carga, último autor de cambios y fechas de creación/publicación/actualización.

## Indexación y RAG

Se usa el SDK oficial `@google/genai` y File Search de Gemini. Los PDF se indexan
directamente. Word se convierte a texto con Mammoth antes de indexarlo, conservando
el original para descargar. Las imágenes incrustadas en Word no se indexan.

La cola persiste en `knowledge_documents`, con estados `PENDING`, `PROCESSING`,
`READY` y `FAILED`. Un cron procesa lotes de tres con un bloqueo asesor de
PostgreSQL compartido entre réplicas; conserva el identificador de operación para
continuar al reiniciar la API. La biblioteca muestra los errores y permite reintentar.

La búsqueda recibe una lista autorizada de IDs publicados mediante filtros de
metadatos. No hay herramientas de SQL, datos de pacientes ni búsqueda web en este
modo. Los archivos se tratan como contenido de consulta, no como instrucciones.
Los documentos retirados se excluyen sin esperar una eliminación remota.

El servidor solo entrega segmentos que Gemini vincula a fragmentos reconocidos de
documentos autorizados. Añade las citas con título, versión, extracto y página
cuando el proveedor la devuelve. Comprueba otra vez la publicación antes de
entregar la respuesta. Sin respaldo devuelve una abstención y registra
`assistant_messages.unanswered=true`; los fallos técnicos se guardan aparte.

Las repreguntas reciben únicamente las preguntas previas del agente, no el texto de
respuestas anteriores, para evitar reutilizar información de fuentes retiradas.
Las conversaciones mantienen una copia de las citas históricas; retirar/eliminar
un archivo impide usarlo en consultas nuevas y puede impedir descargar su original.

## Configuración y despliegue

- `GEMINI_API_KEY`: la misma integración existente, necesaria para preparar y consultar.
- `GEMINI_KNOWLEDGE_MODELS`: modelos compatibles con File Search, en orden;
  por defecto `gemini-3-flash-preview,gemini-2.5-flash-lite`.
- Instalar las dependencias nuevas y ejecutar la migración
  `1785100800000-CreateKnowledgeLibrary` antes de iniciar la API actualizada.
- El índice remoto está en el proyecto de Google vinculado a la clave; el nombre
  de la colección se conserva en `knowledge_search_settings`.

Referencias: [File Search de Gemini](https://ai.google.dev/gemini-api/docs/generate-content/file-search),
[SDK oficial](https://github.com/googleapis/js-genai),
[Mammoth](https://github.com/mwilliamson/mammoth.js).
