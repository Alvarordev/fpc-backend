# FPC Backend

API NestJS de la dashboard de la Fundación Peruana de Cáncer.

## Requisitos

Para el flujo recomendado solo necesitas:

- Docker Engine
- Docker Compose

Para ejecutar el API directamente en Node.js también necesitas Node.js 20 o
superior y npm.

## Levantar en local con Docker

El compose local levanta PostgreSQL y el API con los valores de desarrollo:

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Health check: `http://localhost:3000/health`
- PostgreSQL: `localhost:5432`

Desde este repositorio ejecuta:

```bash
docker compose -f compose.local.yml up -d --build
```

Cuando el contenedor esté iniciado, aplica las migraciones:

```bash
docker compose -f compose.local.yml exec -T api npm run migration:run
```

Comprueba que la API y la base de datos estén disponibles:

```bash
curl http://localhost:3000/health
docker compose -f compose.local.yml ps
```

La respuesta del health check debe indicar que la base de datos está `up`.

Para ver los logs del API:

```bash
docker compose -f compose.local.yml logs -f api
```

Para detener los contenedores sin eliminar los datos de PostgreSQL:

```bash
docker compose -f compose.local.yml down
```

Para eliminar también el volumen local de PostgreSQL, usa `down -v`. Esto borra
la base de datos local.

## Datos de demostración

Después de aplicar las migraciones puedes cargar el dataset de demostración:

```bash
docker compose -f compose.local.yml exec -T api npm run seed:demo
```

El seed elimina los datos existentes antes de insertar los datos de ejemplo.
Las credenciales del administrador se configuran mediante `SEED_ADMIN_EMAIL` y
`SEED_ADMIN_PASSWORD` en `.env`. Las demás cuentas demo usan el dominio
`@fpc.demo` y la contraseña `Demo1234!`.

## Seed de staging (marcha blanca)

Para un entorno limpio (admin + hospitales + catálogos + ubigeo, sin pacientes
demo):

```bash
npm run seed:staging
```

En producción / Dokploy staging exige `SEED_STAGING_FORCE=true`. Ver
[`DEPLOY.md`](DEPLOY.md) y [`spec/catalogs.md`](spec/catalogs.md).

## Variables de entorno

`compose.local.yml` define los valores necesarios para desarrollo:

- `DATABASE_URL`: conexión del API con PostgreSQL.
- `JWT_SECRET`: secreto local para los tokens.
- `CORS_ORIGIN`: origen permitido del frontend, por defecto `http://localhost:5173`.
- `GEMINI_API_KEY`: opcional; deja vacío el valor para desactivar la integración.
- `N8N_WEBHOOK_URL`: opcional; vacío desactiva los webhooks de n8n.
- `PATIENT_DOCUMENT_STORAGE_DRIVER`: `memory` para desarrollo local y `r2` para
  staging/producción.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y
  `R2_BUCKET_NAME`: obligatorias cuando el driver es `r2`.

Los webhooks de n8n se envían después de confirmar transacciones de alertas,
citas médicas y registros de pacientes. Para probarlos localmente configura:

```env
N8N_WEBHOOK_URL=https://tu-endpoint-de-captura
N8N_WEBHOOK_TIMEOUT_MS=5000
```

Si `N8N_WEBHOOK_URL` está vacío, la integración queda desactivada.

Los documentos de pacientes usan un bucket privado de Cloudflare R2. El compose
local usa memoria por defecto y no persiste archivos entre reinicios. Para probar
R2 manualmente, configura explícitamente el bucket de staging y sus credenciales;
nunca uses credenciales de producción en local.

Para ejecutar el API fuera de Docker:

```bash
cp .env.example .env
npm ci
```

Revisa que `.env` use una base accesible desde el host, normalmente:

```env
DATABASE_URL=postgresql://fpc_dev:fpc_dev_password@localhost:5432/fpc_dev
CORS_ORIGIN=http://localhost:5173
```

Luego levanta solo PostgreSQL y ejecuta el API:

```bash
docker compose -f compose.local.yml up -d postgres
npm run migration:run
npm run start:dev
```

No levantes simultáneamente el API de Docker y el API nativo, porque ambos
intentan usar el puerto `3000`.

## Migraciones

Las migraciones se ejecutan manualmente porque `synchronize` está desactivado.
En desarrollo con Docker usa:

```bash
docker compose -f compose.local.yml exec -T api npm run migration:run
```

En una imagen de producción compilada, donde no se incluye `ts-node`, usa:

```bash
./node_modules/.bin/typeorm migration:run -d dist/database/data-source.js
```

Ejecuta las migraciones después de desplegar una nueva versión del backend y
antes de utilizar los cambios que dependan de ellas.

## OpenAPI

`openapi/openapi.json` es el contrato versionado que consume el frontend.

```bash
npm run openapi:generate
npm run openapi:check
```

Después de modificar controladores o DTOs, regenera el contrato y actualiza el
cliente del frontend con `npm run api:generate` desde `fpc-front`.

## Pruebas y build

```bash
npm run build
npm test
npm run test:e2e
```

Las pruebas e2e limpian y vuelven a cargar la base de datos de demostración.
No las ejecutes contra una base de datos con información que quieras conservar.
