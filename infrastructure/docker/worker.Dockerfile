FROM node:24-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI="true"

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      openssl \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

RUN DATABASE_URL="postgresql://build:build@127.0.0.1:59999/build?schema=public" \
    pnpm --dir packages/database run prisma:generate

RUN pnpm --filter @edumall/worker build

USER node

CMD ["./node_modules/.bin/tsx", "--tsconfig", "apps/worker/tsconfig.json", "apps/worker/src/main.ts"]
