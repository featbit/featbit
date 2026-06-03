#!/bin/sh
# Web container entrypoint.
#
# 1. If DATABASE_URL is set, run `prisma migrate deploy` against it.
#    Idempotent — safely re-runs on every container start. Skipped when
#    DATABASE_URL is empty so the image can be used for non-DB tasks.
# 2. Hand off to whatever CMD was specified (default: node server.js).

set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Running prisma migrate deploy…"
  prisma migrate deploy --schema=./prisma/schema.prisma
else
  echo "[entrypoint] DATABASE_URL not set — skipping migrations."
fi

echo "[entrypoint] Starting: $*"
exec "$@"
