# Cloudflare Deployment Runbook (agent/web)

This runbook deploys the Next.js web service to Cloudflare Containers and keeps DB schema/data aligned.

## 1. Prerequisites

- `wrangler` authenticated to the target Cloudflare account
- Remote PostgreSQL is reachable
- `agent/web/.env` contains a valid `DATABASE_URL` (ignored by git)

## 2. Keep schema aligned (docker/local and Azure PG)

Apply structure to any target DB:

```powershell
cd agent/web
$env:DATABASE_URL="<target-db-url>"
npm run db:apply-structure
```

Compare local docker DB and Azure DB structure:

```powershell
cd agent/web
$env:LOCAL_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/release_decision"
$env:REMOTE_DATABASE_URL="postgresql://<user>:<pass>@<host>:5432/<db>?sslmode=require"
npm run db:compare-structure
```

`db:compare-structure` checks:
- table existence in `public`
- column shape (name, type, nullable, default)
- primary key columns

## 3. Migrate business data (exclude event tables)

This migrates data while **excluding**:
- `_prisma_migrations`
- `flag_evaluations`
- `metric_events`

```powershell
cd agent/web
$env:SOURCE_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/release_decision"
$env:TARGET_DATABASE_URL="postgresql://<user>:<pass>@<host>:5432/<db>?sslmode=require"
npm run db:migrate-business-data
```

Optional extra excludes:

```powershell
$env:EXCLUDE_TABLES="some_table,another_table"
```

## 4. Deploy to Cloudflare

One-command deploy:

```powershell
cd agent/web
powershell -ExecutionPolicy Bypass -File scripts/deploy-cloudflare.ps1 -DatabaseUrl "postgresql://<user>:<pass>@<host>:5432/<db>?sslmode=require"
```

What it does:
- updates `DATABASE_URL` secret in Cloudflare Worker `featbit-web`
- runs `wrangler deploy`
- performs basic health checks on:
  - `https://featbit.ai`
  - `https://www.featbit.ai`
  - `/experiments`

## 5. Notes

- `agent/web/.env` is gitignored and safe for local-only credentials.
- Event table **schema** should be aligned via `db:apply-structure`.
- Event table **data** is intentionally not migrated by `db:migrate-business-data`.
