# Release Decision Web

This is the standalone React + Vite frontend for release-decision experiments.

## Local Aspire

Aspire starts this app as `release-decision-web` on port `3000`.

The app talks to the FeatBit API server through `VITE_FEATBIT_API_URL`, which is set by `.aspire/AppHost.cs` to `http://localhost:5000` for local debug.

## Database Ownership

The release-decision experiment schema is owned by the FeatBit API project.

For PostgreSQL local setup, use:

```text
infra/postgresql/docker-entrypoint-initdb.d/v5.5.0.sql
```

Do not apply the old Prisma migrations from this app for experiment data. The canonical tables are:

```text
release_decision_experiments
release_decision_experiment_runs
release_decision_activities
release_decision_messages
```

The frontend is browser-only. Experiment reads, writes, and analysis go through the FeatBit API endpoints; do not reintroduce Prisma or frontend-owned API routes for runtime experiment data.
