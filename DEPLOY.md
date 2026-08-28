# Despliegue con Dokploy

## Flujo

GitHub Actions construye y publica solamente la imagen del backend. Dokploy no
construye el repositorio: hace pull de la imagen y despliega cuando recibe el
webhook.

| Rama      | Entorno    | Imagen que debe usar Dokploy                 |
| --------- | ---------- | -------------------------------------------- |
| `develop` | staging    | `ghcr.io/alvarordev/fpc-backend:dev-latest`  |
| `main`    | production | `ghcr.io/alvarordev/fpc-backend:prod-latest` |

Cada ejecución también publica un tag inmutable con el SHA completo:
`dev-<sha>` o `prod-<sha>`. Estos tags sirven para rollback. El workflow de
producción usa el environment `production`, donde se pueden configurar
revisores obligatorios antes del despliegue.

Un push a `develop` inicia el workflow de staging; un push a `main` inicia el
workflow de production.

Si el paquete de GHCR es privado, Dokploy debe tener configuradas credenciales
de lectura del registry. Esas credenciales se configuran en Dokploy y no se
guardan en este repositorio.

## Dokploy

Crear dos aplicaciones independientes, una para staging y otra para
production. Configurar en cada una:

- Imagen correspondiente `*-latest`.
- Puerto del contenedor `3000`.
- Red overlay `dokploy-network`.
- Webhook de la aplicación en el secret correspondiente de GitHub.

Postgres se crea como servicio **Database** de Dokploy, una instancia aislada
por entorno. No agregarlo a un compose de Dokploy ni construir/publicar una
imagen de Postgres. La base no publica `5432` en el host; la app se conecta al
hostname interno del servicio de base dentro de `dokploy-network`.

El `compose.local.yml` permanece destinado al desarrollo local y sigue
levantando su propio Postgres con el hostname `postgres`.

## Variables de runtime

Configurar estas variables en la aplicación de Dokploy. Los valores marcados
como obligatorios no tienen un valor seguro por defecto.

### Secretas

| Variable               | Requerida      | Notas                                                               |
| ---------------------- | -------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`         | Sí             | URL completa de PostgreSQL; contiene credenciales.                  |
| `JWT_SECRET`           | Sí             | Mínimo 32 caracteres.                                               |
| `GEMINI_API_KEY`       | No             | Opcional para boot; necesaria al usar generación de resúmenes.      |
| `N8N_WEBHOOK_URL`      | No             | Puede contener tokens; vacía desactiva n8n.                         |
| `SEED_ADMIN_PASSWORD`  | Solo para seed | Contraseña del administrador creado por `seed:admin` o `seed:demo`. |
| `R2_ACCESS_KEY_ID`     | Sí             | Token R2 limitado al bucket del entorno.                            |
| `R2_SECRET_ACCESS_KEY` | Sí             | Secreto del token R2 del entorno.                                   |

### No secretas

| Variable                                    | Requerida      | Default o formato                                                                               |
| ------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                  | No             | Usar `production`; default del código: `development`.                                           |
| `PORT`                                      | No             | `3000`.                                                                                         |
| `JWT_EXPIRES_IN`                            | No             | `1h`.                                                                                           |
| `REFRESH_TOKEN_EXPIRES_IN`                  | No             | `7d`.                                                                                           |
| `REFRESH_TOKEN_COOKIE_NAME`                 | No             | `refresh_token`.                                                                                |
| `CORS_ORIGIN`                               | Sí             | URI del frontend; no acepta `*`.                                                                |
| `GEMINI_MODEL`                              | No             | El default del código es `gemini-2.0-flash`.                                                    |
| `PATIENT_SUMMARY_RATE_LIMIT`                | No             | `10`.                                                                                           |
| `PATIENT_SUMMARY_RATE_LIMIT_WINDOW_SECONDS` | No             | `60`.                                                                                           |
| `N8N_WEBHOOK_TIMEOUT_MS`                    | No             | `5000`, entre `100` y `30000`.                                                                  |
| `PATIENT_DOCUMENT_STORAGE_DRIVER`           | Sí             | Usar `r2` en staging y producción.                                                              |
| `PATIENT_DOCUMENT_MAX_BYTES`                | No             | `10485760` bytes; no superar el límite del MVP.                                                 |
| `R2_ACCOUNT_ID`                             | Sí             | ID de la cuenta Cloudflare que contiene el bucket.                                              |
| `R2_BUCKET_NAME`                            | Sí             | Bucket privado específico del entorno.                                                          |
| `R2_ENDPOINT`                               | No             | `https://<account-id>.r2.cloudflarestorage.com`; se deriva del account ID si se omite.          |
| `SEED_ADMIN_EMAIL`                          | Solo para seed | Email del administrador.                                                                        |
| `SEED_DEMO_SEED`                            | Solo para seed | Entero; default `20260805`.                                                                     |
| `SEED_DEMO_NOW`                             | Solo para seed | Fecha opcional para fijar la fecha de referencia.                                               |
| `SEED_DEMO_FORCE`                           | Solo para seed | `true` permite el seed demo destructivo con `NODE_ENV=production`. No configurarlo normalmente. |

`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` y las variables `SEED_DEMO_*` no son
necesarias para que la API arranque. El archivo `.env.example` muestra
`gemini-3.1-flash-lite`, pero si `GEMINI_MODEL` se omite el valor efectivo del
validador es `gemini-2.0-flash`.

### Cloudflare R2

Staging y producción deben usar buckets y tokens distintos. Los buckets deben
permanecer privados y los tokens deben limitarse al bucket correspondiente. El
frontend no necesita ninguna variable R2: todas las cargas y lecturas pasan por
la API autenticada.

#### Pasos en Cloudflare

Repetir los pasos de bucket y token por separado para staging y producción:

1. En Cloudflare, abrir **R2 Object Storage** y crear el bucket del entorno,
   por ejemplo `fpc-patient-documents-staging` y
   `fpc-patient-documents-production`.
2. En la configuración de cada bucket, mantener desactivados **Public
   Development URL** y **Custom Domains**. No crear un dominio público para los
   documentos clínicos.
3. En **R2 > Overview**, dentro de **Account Details**, seleccionar **Manage**
   junto a **API Tokens** y crear un token de cuenta nuevo.
4. Elegir el permiso **Object Read & Write** y restringir el token únicamente al
   bucket del entorno. No usar **Admin Read & Write** ni seleccionar todos los
   buckets.
5. Copiar el **Access Key ID** y el **Secret Access Key** inmediatamente. El
   secreto solo se muestra una vez. Copiar también el **Account ID** de la cuenta.

Configurar las variables siguientes en la aplicación correspondiente de
Dokploy. El valor de `R2_BUCKET_NAME` debe ser diferente entre entornos:

```dotenv
NODE_ENV=production
PATIENT_DOCUMENT_STORAGE_DRIVER=r2
PATIENT_DOCUMENT_MAX_BYTES=10485760
R2_ACCOUNT_ID=<account-id>
R2_ACCESS_KEY_ID=<access-key-id-del-token-del-entorno>
R2_SECRET_ACCESS_KEY=<secret-access-key-del-token-del-entorno>
R2_BUCKET_NAME=fpc-patient-documents-staging
# R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

En producción se usa el mismo bloque, cambiando `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY` y `R2_BUCKET_NAME` por los valores del token y bucket de
producción. `R2_ENDPOINT` puede omitirse porque la API lo deriva del account ID.
Si el bucket se creó con una jurisdicción específica, configurar el endpoint de
esa jurisdicción en lugar del endpoint general.

Después de desplegar la imagen, ejecutar una sola vez y de forma serializada la
migración indicada en la sección [Migraciones](#migraciones). Luego validar con
un usuario `ADMIN`, `FOUNDATION` o `AGENT` que puede listar, cargar, descargar y
archivar un documento de prueba en el bucket correcto. El contenido archivado
debe responder `410` y el listado normal no debe mostrarlo.

No configurar estas variables en el frontend ni en GitHub Actions. Si se pierde
un secreto, revocar el token en Cloudflare y crear uno nuevo para el mismo
bucket.

Referencias oficiales: [crear tokens R2](https://developers.cloudflare.com/r2/api/s3/tokens/)
y [desactivar acceso público](https://developers.cloudflare.com/r2/buckets/public-buckets/).

## Base de datos

La aplicación no espera `DB_HOST`, `DB_PORT`, `DB_USER` ni `DB_PASSWORD` por
separado. Espera exactamente una variable `DATABASE_URL` con este formato:

```text
postgresql://<usuario>:<password>@<hostname-del-servicio-dokploy>:5432/<base_de_datos>
```

El hostname debe ser el nombre real generado por Dokploy para la base del
entorno, por ejemplo `fpc-db-staging-<id>`. No usar `localhost` en Dokploy.
Codificar con URL encoding los caracteres especiales que aparezcan en usuario
o password.

## Migraciones

TypeORM tiene `synchronize: false` y las migraciones **no** corren al bootear la
API. El despliegue debe ejecutar una vez, de forma serializada, el siguiente
comando dentro del contenedor de la aplicación, usando las variables de
runtime y la red de Dokploy:

```bash
node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
```

El comando `npm run migration:run` está pensado para desarrollo: apunta al
DataSource TypeScript y requiere dependencias de desarrollo que no están en la
imagen final.

Ejecutar la migración una vez por despliegue es seguro cuando se serializa y
TypeORM no encuentra migraciones pendientes. No ejecutar dos comandos de
migración concurrentemente desde varias réplicas: las migraciones actuales
incluyen operaciones como `CREATE INDEX` sin `IF NOT EXISTS` y no tienen un
lock de despliegue propio.

## Healthcheck

- Puerto interno: `3000`.
- Endpoint: `GET /health`.
- El endpoint comprueba también la conexión a PostgreSQL.
- El `Dockerfile` ya incluye un `HEALTHCHECK` contra
  `http://localhost:3000/health` y ejecuta la imagen final como usuario
  no-root.

## Secrets de GitHub

Crear estos secrets antes de usar los workflows:

- `DOKPLOY_WEBHOOK_STAGING`: webhook HTTP de la aplicación staging.
- `DOKPLOY_WEBHOOK_PROD`: webhook HTTP de la aplicación production.

`GITHUB_TOKEN` es el token automático de GitHub Actions con permiso
`packages: write`; no hace falta crear un PAT para publicar en GHCR.
