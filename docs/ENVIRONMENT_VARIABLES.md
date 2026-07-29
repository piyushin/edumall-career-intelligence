# Environment Variables

Only `.env.example` files are committed. Real `.env` files are ignored.

## Shared Variables

| Variable               |            Required | Description                                             |
| ---------------------- | ------------------: | ------------------------------------------------------- |
| `NODE_ENV`             |                 Yes | `development`, `test`, or `production`.                 |
| `APP_ENV`              |                 Yes | `local`, `test`, `staging`, or `production`.            |
| `APP_VERSION`          |                 Yes | Build or release version displayed by health endpoints. |
| `LOG_LEVEL`            |                 Yes | `debug`, `info`, `warn`, or `error`.                    |
| `DATABASE_URL`         | API/worker/database | PostgreSQL connection string.                           |
| `REDIS_URL`            |          API/worker | Redis connection string.                                |
| `CORS_ALLOWED_ORIGINS` |                 API | Comma-separated allowed browser origins.                |

## CORS Rules

Production must not use wildcard origins. The configuration loader rejects wildcard CORS origins when `APP_ENV=production`.

## Local Docker Variables

| Variable            | Description                                 |
| ------------------- | ------------------------------------------- |
| `POSTGRES_USER`     | Local PostgreSQL user.                      |
| `POSTGRES_PASSWORD` | Local-only PostgreSQL password placeholder. |
| `POSTGRES_DB`       | Local database name.                        |
| `POSTGRES_PORT`     | Host port bound to `127.0.0.1`.             |
| `REDIS_PORT`        | Host port bound to `127.0.0.1`.             |

## Secret Handling

Use managed secrets in deployed environments. Do not commit real credentials, tokens, private keys, connection strings, or service-account files.
