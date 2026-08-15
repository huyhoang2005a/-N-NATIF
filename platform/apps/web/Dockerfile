# Build context MUST be the monorepo root: `docker build -f apps/web/Dockerfile .`
#
# NEXT_PUBLIC_API_BASE_URL (apps/web/lib/api-client.ts) is baked into the client JS bundle
# at `next build` time, NOT read at container start — a runtime `environment:` override in
# compose has zero effect on it. MUST be passed as --build-arg pointing at the API's real
# public URL for a non-localhost deployment, e.g.:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com/v1 -t r2m-web .

FROM node:22-alpine AS base
RUN corepack enable && npm install -g turbo@2.10.7
WORKDIR /app

FROM base AS pruner
COPY . .
RUN turbo prune @r2m/web --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM installer AS builder
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/v1
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY --from=pruner /app/out/full/ .
# `turbo prune` doesn't carry root-level shared config outside package.json/turbo.json —
# @r2m/domain (a transitive dep via @r2m/contracts) extends this one relatively.
COPY tsconfig.base.json tsconfig.base.json
RUN turbo run build --filter=@r2m/web

# --- Runtime image: Next.js standalone output (self-contained, traced node_modules) ---
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S r2m && adduser -S r2m -G r2m
COPY --from=builder --chown=r2m:r2m /app/apps/web/.next/standalone ./
COPY --from=builder --chown=r2m:r2m /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=r2m:r2m /app/apps/web/public ./apps/web/public
USER r2m
EXPOSE 3001
ENV PORT=3001
CMD ["node", "apps/web/server.js"]
