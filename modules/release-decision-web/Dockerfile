FROM node:20-alpine AS base

# ── Stage 1: Install dependencies ───────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build the application ──────────────────────────────────────────
FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client for the target platform (linux-musl / Alpine)
RUN npx prisma generate

RUN npm run build

# ── Stage 3: Production runner ───────────────────────────────────────────────
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma CLI is needed by docker-entrypoint.sh to run `prisma migrate deploy`
# on every container start. Pinned to the same version as @prisma/client in
# package.json so client + CLI never drift.
RUN npm install -g prisma@5.22.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Static assets and standalone server bundle
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma generated client + native query engine binary
COPY --from=builder --chown=nextjs:nodejs /app/src/generated/prisma ./src/generated/prisma

# Prisma schema + migrations — needed by `prisma migrate deploy` in the
# entrypoint. Migrations are applied on every container start (idempotent).
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Markdown specs read at runtime by /data-warehouse/customer-endpoints/schema.
# Standalone build doesn't bundle source files outside .next/, so copy
# explicitly. Tiny (a handful of KB).
COPY --from=builder --chown=nextjs:nodejs /app/docs ./docs

# Entrypoint that runs migrations before starting the server.
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
