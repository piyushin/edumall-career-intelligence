# Development Setup

## Prerequisites

- Node.js 24 or newer.
- pnpm 11 or newer.
- Docker with Docker Compose.

## Install Dependencies

```bash
pnpm install
```

## Configure Environment

Copy the example files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/worker/.env.example apps/worker/.env
```

Use local-only placeholder values. Do not commit real secrets.

## Start Local Services

```bash
pnpm services:up
```

This starts PostgreSQL and Redis bound to `127.0.0.1`.

## Prisma

Generate the Prisma client:

```bash
pnpm prisma:generate
```

Apply local migrations:

```bash
pnpm db:migrate:local
```

## Start Applications

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

Default local URLs:

- Web: `http://localhost:3000`
- Web status: `http://localhost:3000/status`
- API health: `http://localhost:3001/health`
- API readiness: `http://localhost:3001/ready`

## Stop Local Services

```bash
pnpm services:down
```
