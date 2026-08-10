## Plan: Remove Legacy Data Experiments and DA

Remove the Python DA server and the legacy .NET experiment, metric, and OLAP-query implementation. Keep the complete backend insight-consumer and persistence pipeline, `featbit-insights` publication, and generic ClickHouse infrastructure for the replacement module. Preserve existing database schemas/data and leave both UI implementations unchanged.

**1. Confirm Replacement Contracts**
1. Treat these front-end-v2 contracts as release gates:
   - `GET /api/v1/envs/{envId}/feature-flags/insights`
   - `GET /api/v1/envs/{envId}/end-users/get-by-featureflag`
2. The replacement must preserve the queries and responses consumed by [insights-api.ts](modules/front-end-v2/src/features/flags/details/insights/insights-api.ts) and [verify-connection-step.tsx](modules/front-end-v2/src/features/get-started/components/verify-connection-step.tsx).
3. Preserve `POST /api/public/insight/track`, its payload format, and `featbit-insights` publication.

**2. Remove the Old Backend Implementation**
1. Delete the old controllers:
   - [ExperimentController.cs](modules/back-end/src/Api/Controllers/ExperimentController.cs)
   - [ExperimentMetricController.cs](modules/back-end/src/Api/Controllers/ExperimentMetricController.cs)
2. Delete the complete [Experiments](modules/back-end/src/Application/Experiments) and [ExperimentMetrics](modules/back-end/src/Application/ExperimentMetrics) application slices.
3. Delete their service interfaces, domain models, EF/Mongo services, and EF configurations.
4. Remove corresponding registrations and mappings from:
   - [DbServiceCollectionExtensions.cs](modules/back-end/src/Infrastructure/Persistence/DbServiceCollectionExtensions.cs)
   - [AppDbContext.cs](modules/back-end/src/Infrastructure/Persistence/EntityFrameworkCore/AppDbContext.cs)
   - [MongoDbClient.cs](modules/back-end/src/Infrastructure/Persistence/MongoDb/MongoDbClient.cs)
5. Remove the experiment-specific feature-flag reference flow and associated error codes/tests.

**3. Remove OLAP APIs and Preserve the Insight Consumer**
1. Delete [IOlapService.cs](modules/back-end/src/Application/Services/IOlapService.cs), [OlapService.cs](modules/back-end/src/Infrastructure/Services/OlapService.cs), and their HTTP client/configuration.
2. Remove the old feature-flag insights and evaluated-user handlers, DTOs, filters, validators, and controller actions.
3. Keep the complete backend insight-consumer and persistence path for the replacement implementation:
   - `IInsightService`
   - `InsightMessageHandler`
   - `InsightsWriter`
   - EF and Mongo `InsightService` implementations
4. Keep the existing provider behavior: Redis/Postgres subscribe the backend to `Topics.Insights`, while the backend intentionally does not subscribe in Kafka deployments. In Kafka deployments, ClickHouse consumes `featbit-insights` through its Kafka-engine table and materialized view; the replacement will use the same pattern.
5. Keep usage and end-user message handling unchanged.

**4. Preserve Telemetry and Data**
1. Keep [InsightController.cs](modules/evaluation-server/src/Api/Public/InsightController.cs), evaluation insight DTOs, and `Topics.Insights`.
2. Keep Kafka provisioning for `featbit-insights` and preserve ClickHouse as its consumer in Kafka deployments. The replacement module will own creation of its Kafka-engine table, materialized view, and destination schema.
3. Do not edit historical PostgreSQL or MongoDB initialization scripts and do not add drop migrations. Generate a script to delete existing tables, collections, indexes, and data, only for reference and verification. The replacement module will create its own schema and data.
4. Keep generic ClickHouse services, manifests, image mappings, and [infra/clickhouse](infra/clickhouse) for replacement ownership.

**5. Remove DA Runtime and Packaging**
1. Delete [modules/data-analytics](modules/data-analytics) after the backend compiles without it.
2. Remove `da-server`, `depends_on`, `OLAP__ServiceHost`, DA health checks, and DA environment settings from every root and specialized compose file.
3. Delete the standard/pro DA Kubernetes deployment and service manifests.
4. Remove DA apply commands and API OLAP settings from Kubernetes deployment scripts/manifests.
5. Keep ClickHouse, Kafka, and `featbit-insights` topic creation in those stacks.

**6. Clean Release and Control-Plane Surfaces**
1. Remove the DA image entry from [publish-docker-images.yml](.github/workflows/publish-docker-images.yml).
2. Remove DA image validation, build, registry, deployment rewriting, and analytics-store configuration from [e2e/control-plane](e2e/control-plane).
3. Keep the control-plane test suite itself and its shared Kafka/ClickHouse infrastructure.
4. Update root, backend, front-end-v2, Docker, Kubernetes, and control-plane documentation to remove DA instructions.
5. Make no changes under [modules/front-end](modules/front-end).

**Verification**
1. Run backend restore, Release build, focused validator/authorization tests, and the complete backend test suite.
2. Run backend insight-consumer tests for parsing, buffering, flushing, and EF/Mongo persistence through the existing configured subscriptions.
3. Run evaluation-server Release build/tests, especially `InsightControllerTests`, proving insight, usage, and end-user publication remains intact.
4. Run `npm run lint`, `npm test`, and `npm run build` in [modules/front-end-v2](modules/front-end-v2).
5. Validate every retained compose file with `docker compose -f <file> config`.
6. Run Kubernetes client dry-runs for standard/pro application and infrastructure manifests.
7. Parse changed PowerShell deployment scripts without executing them.
8. Scan for residual `da-server`, `modules/data-analytics`, DA image, `OLAP__ServiceHost`, and old experiment namespaces. Separately assert that the retained insight-consumer symbols and registrations are still present.
9. Smoke-test standard, professional, MongoDB, and control-plane deployments. No DA workload or OLAP setting should remain, insight publication must remain intact, and the replacement must satisfy the unchanged React endpoints.

The critical release dependency is endpoint ownership: deleting the old API actions while leaving front-end-v2 unchanged is valid only when the replacement serves those two routes compatibly.