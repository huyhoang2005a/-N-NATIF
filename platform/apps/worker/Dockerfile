# Build context MUST be the monorepo root: `docker build -f apps/worker/Dockerfile .`

FROM node:22-alpine AS base
RUN corepack enable && npm install -g turbo@2.10.7
WORKDIR /app

FROM base AS pruner
COPY . .
RUN turbo prune @r2m/worker --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY --from=pruner /app/out/full/ .
# `turbo prune` doesn't carry root-level shared config outside package.json/turbo.json —
# every package's tsconfig.json extends this one relatively, so tsc fails without it.
COPY tsconfig.base.json tsconfig.base.json
RUN turbo run build --filter=@r2m/worker

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S r2m && adduser -S r2m -G r2m
COPY --from=builder --chown=r2m:r2m /app .
USER r2m
EXPOSE 9200
CMD ["node", "apps/worker/dist/main.js"]
