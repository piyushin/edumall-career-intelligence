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

## Commerce Variables (API)

| Variable                  | Required | Purpose                                                                                                                                                              |
| ------------------------- | -------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RAZORPAY_KEY_ID`         | Optional | Razorpay key id. When absent, online payment intents report `gatewayConfigured: false` and orders may still complete through coupons or central manual approval.     |
| `RAZORPAY_KEY_SECRET`     | Optional | Razorpay key secret used to create gateway orders and verify browser payment signatures.                                                                             |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | Secret configured on the Razorpay webhook. `POST /commerce/webhooks/razorpay` returns 503 until it is set; with it set, captured payments are fulfilled server-side. |

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
