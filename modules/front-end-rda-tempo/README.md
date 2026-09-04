# Release Decision Web

This is the standalone React + Vite frontend for release-decision experiments.

## Local Aspire

Aspire starts this app as `release-decision-web` on an Aspire-managed HTTP
endpoint. Use `aspire describe --format Json --non-interactive` to get the
current URL.

The app talks to the same FeatBit API resource as the current frontend through
`VITE_FEATBIT_API_URL`. Both frontends therefore read and write the same
PostgreSQL-backed data through the API; this browser app never connects to the
database directly.

## Database Ownership

The release-decision experiment schema is owned by the FeatBit API project.

For PostgreSQL local setup, use:

```text
infra/postgresql/docker-entrypoint-initdb.d/v6.0.0.sql
```

Do not apply the old Prisma migrations from this app for experiment data. The canonical tables are:

```text
release_decision_experiments
release_decision_experiment_runs
release_decision_activities
```

The frontend is browser-only. Experiment reads, writes, and analysis go through the FeatBit API endpoints; do not reintroduce Prisma or frontend-owned API routes for runtime experiment data.
