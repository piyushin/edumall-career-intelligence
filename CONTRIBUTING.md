# Contributing

## Branching

Work on feature branches. Do not work directly on `main`.

Recommended branch format:

```text
phase-0/short-description
feature/short-description
fix/short-description
docs/short-description
```

## Required Checks

Before committing, run:

```bash
pnpm format:check
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

Run Docker validation when local services are touched:

```bash
docker compose -f infrastructure/docker/docker-compose.yml config
pnpm services:up
pnpm services:down
```

## Phase Boundaries

Phase 0 is engineering foundation only. Do not add assessment items, scoring formulas, report narratives, user/tenant workflows, authentication flows, payment logic, or production infrastructure in Phase 0.

## Secrets

Commit `.env.example` files only. Never commit `.env`, credentials, tokens, private keys, personal data, assessment responses, or real candidate information.

## Pre-Commit

The repository uses Husky and lint-staged. The pre-commit hook runs formatting checks and ESLint on staged files.
