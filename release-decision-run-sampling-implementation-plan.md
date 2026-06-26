# Release Decision Run Sampling - Implementation Result

## Final Checklist

- [x] Keep feature flag evaluation as the source of truth for served variation.
- [x] Add run-level fields: `assignmentUnitSelector`, `layerTrafficPercent`, and `analysisSamplingPlan`.
- [x] Keep legacy `trafficPercent`, `trafficOffset`, `sliceStart`, `sliceEnd`, and `allocationPlan` readable for compatibility.
- [x] Stop the new frontend/API path from writing generated `sliceStart`, `sliceEnd`, and `allocationPlan`.
- [x] Apply the new stats flow to PostgreSQL, MongoDB, and ClickHouse providers.
- [x] PostgreSQL and MongoDB persist run assignment snapshots for audit/debug.
- [x] ClickHouse keeps using raw exposure/metric tables and does not add a new assignment table.
- [x] Update PostgreSQL `v6.0.0.sql` init/migration script.
- [x] Update MongoDB `v6.0.0.js` init script.
- [x] Update release-decision frontend API/types/actions.
- [x] Replace the old Run Slice UI with Layer Eligibility and Analysis Sampling UI.
- [x] Replace the old hash-space traffic pool UI with layer/sampling summary UI.
- [x] Add/update unit test coverage for passing run sampling scope into analysis.
- [x] Add/update provider parity tests for PostgreSQL, MongoDB, and ClickHouse.
- [x] Update `v6.0.0-pr-review.md`.
- [x] Delete the temporary implementation plan after implementation, then recreate this final result file for review.

## Final Runtime Semantics

The stats query no longer tries to reconstruct feature-flag rollout assignment by re-hashing a guessed rollout key.

1. Exposure events carry the actual served `variation_id`.
2. The selected run defines which variation is control/baseline and which variations are treatment/arms.
3. `assignmentUnitSelector` decides the unit of analysis.
   - `user.keyId`, `user.key`, or empty selector uses exposure/metric `user_key`.
   - Custom selectors read the exact property from event `properties`.
   - Missing custom properties are excluded, with no fallback to `user_key`.
4. Layer eligibility is optional and only gates whether an assignment unit can participate in this run.
5. Sampling is applied inside each actual served variation using `analysisSamplingPlan[].includeRate`.
6. After filtering, the first valid exposure per assignment unit wins.
7. Metrics are joined only after that assignment exposure time.
8. Per-assignment-unit metric contribution still supports `once`, `count`, `sum`, and `average`.

## Example: 90/10 Flag, Analyze 10% Control + All Treatment

For a feature flag currently serving:

- `control_current`: 90% total traffic
- `treatment_dotnet`: 10% total traffic

To compare 10 percentage points of control against all 10 percentage points of treatment:

- Control include rate should be `11.111111%` of the control variation traffic.
- Treatment include rate should be `100%` of the treatment variation traffic.

That yields approximately:

- `90% * 11.111111% = 10%` total traffic control sample
- `10% * 100% = 10%` total traffic treatment sample

This is why the UI has a `90/10 -> 10/10` preset instead of asking for old slice buckets.

## Layer Semantics

Layer traffic is independent from feature flag variation split.

If a run is inside a layer with `layerTrafficPercent = 30`, only approximately 30% of assignment units are eligible for that run first. Then actual feature flag evaluation still decides which variation each eligible user saw. Finally, the analysis sampling plan decides how much of each actual variation contributes to evidence.

## Files Changed

Backend model and API:

- `modules/back-end/src/Domain/ReleaseDecisions/ReleaseDecisionExperimentRun.cs`
- `modules/back-end/src/Domain/ReleaseDecisions/ReleaseDecisionRunAssignment.cs`
- `modules/back-end/src/Application/ReleaseDecisions/ManageReleaseDecisionExperimentRun.cs`
- `modules/back-end/src/Application/ReleaseDecisions/ReleaseDecisionExperimentVm.cs`
- `modules/back-end/src/Application/ExperimentStats/QueryExperimentStats.cs`

Persistence and scripts:

- `modules/back-end/src/Infrastructure/Persistence/EntityFrameworkCore/AppDbContext.cs`
- `modules/back-end/src/Infrastructure/Persistence/EntityFrameworkCore/Configurations/ReleaseDecisionExperimentRunConfiguration.cs`
- `modules/back-end/src/Infrastructure/Persistence/EntityFrameworkCore/Configurations/ReleaseDecisionRunAssignmentConfiguration.cs`
- `modules/back-end/src/Infrastructure/Persistence/MongoDb/MongoDbClient.cs`
- `infra/postgresql/docker-entrypoint-initdb.d/v6.0.0.sql`
- `infra/mongodb/docker-entrypoint-initdb.d/v6.0.0.js`

Stats providers:

- `modules/back-end/src/Infrastructure/Services/EntityFrameworkCore/ReleaseDecisionExperimentStatsService.cs`
- `modules/back-end/src/Infrastructure/Services/MongoDb/ReleaseDecisionExperimentStatsService.cs`
- `modules/back-end/src/Infrastructure/Services/ClickHouse/ReleaseDecisionExperimentStatsService.cs`

Frontend:

- `modules/release-decision-web/src/lib/release-decision-types.ts`
- `modules/release-decision-web/src/lib/release-decision-api.ts`
- `modules/release-decision-web/src/lib/actions.ts`
- `modules/release-decision-web/src/components/experiment/experiment-run-traffic-config.tsx`
- `modules/release-decision-web/src/components/experiment/traffic-pool-view.tsx`
- `modules/release-decision-web/src/components/experiment/experiment-run-table.tsx`
- `modules/release-decision-web/src/components/experiment/variant-identity.tsx`

Tests and review notes:

- `modules/back-end/tests/Application.UnitTests/ReleaseDecisions/ReleaseDecisionAnalysisAlgorithmTests.cs`
- `modules/back-end/tests/Infrastructure.IntegrationTests/ReleaseDecisions/ReleaseDecisionProviderParityFixture.cs`
- `modules/back-end/tests/Infrastructure.IntegrationTests/ReleaseDecisions/ReleaseDecisionProviderParityTests.cs`
- `v6.0.0-pr-review.md`

## Verification Completed

- [x] `npm run lint` in `modules/release-decision-web`
- [x] `npm run build` in `modules/release-decision-web`
- [x] `dotnet build modules/back-end/src/Api/Api.csproj /p:UseSharedCompilation=false`
- [x] `dotnet test modules/back-end/tests/Application.UnitTests/Application.UnitTests.csproj --filter "FullyQualifiedName~ReleaseDecisionAnalysisAlgorithmTests.AnalyzeRun_passes_run_sampling_scope_to_stats_query" --logger "console;verbosity=minimal" /p:UseSharedCompilation=false`
- [x] `dotnet test modules/back-end/tests/Infrastructure.IntegrationTests/Infrastructure.IntegrationTests.csproj --filter "FullyQualifiedName~ReleaseDecisionProviderParityTests" --logger "console;verbosity=minimal" /p:UseSharedCompilation=false`

