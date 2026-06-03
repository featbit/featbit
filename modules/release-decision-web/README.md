# Release Decision Web

This is the standalone Next.js frontend for release-decision experiments.

## Local Aspire

Aspire starts this app as `release-decision-web` on port `3000`.

The app talks to the FeatBit API server through `FEATBIT_API_URL`, which is set by `aspire-apphost/AppHost.cs` to `http://localhost:5000` for local debug.

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

The next migration step is to replace the remaining Prisma-backed Next.js API/data access with FeatBit API endpoints, then remove the obsolete Prisma experiment routes and migrations.
