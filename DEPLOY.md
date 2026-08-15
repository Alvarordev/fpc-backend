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

| Variable              | Requerida      | Notas                                                               |
| --------------------- | -------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`        | Sí             | URL completa de PostgreSQL; contiene credenciales.                  |
| `JWT_SECRET`          | Sí             | Mínimo 32 caracteres.                                               |
| `GEMINI_API_KEY`      | No             | Opcional para boot; necesaria al usar generación de resúmenes.      |
| `N8N_WEBHOOK_URL`     | No             | Puede contener tokens; vacía desactiva n8n.                         |
| `SEED_ADMIN_PASSWORD` | Solo para seed | Contraseña del administrador creado por `seed:admin` o `seed:demo`. |

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
| `SEED_ADMIN_EMAIL`                          | Solo para seed | Email del administrador.                                                                        |
| `SEED_DEMO_SEED`                            | Solo para seed | Entero; default `20260805`.                                                                     |
| `SEED_DEMO_NOW`                             | Solo para seed | Fecha opcional para fijar la fecha de referencia.                                               |
| `SEED_DEMO_FORCE`                           | Solo para seed | `true` permite el seed demo destructivo con `NODE_ENV=production`. No configurarlo normalmente. |

`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` y las variables `SEED_DEMO_*` no son
necesarias para que la API arranque. El archivo `.env.example` muestra
`gemini-3.1-flash-lite`, pero si `GEMINI_MODEL` se omite el valor efectivo del
validador es `gemini-2.0-flash`.

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
