FROM node:24-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @edumall/worker build

USER node

CMD ["pnpm", "--filter", "@edumall/worker", "start"]
