FROM node:24-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @edumall/database prisma:generate
RUN pnpm --filter @edumall/api build

USER node

CMD ["./node_modules/.bin/tsx", "--tsconfig", "apps/api/tsconfig.json", "apps/api/src/main.ts"]
