# Release Decision Follow-up Checklist

## Goal

Close the gaps left after the run sampling redesign:

1. Make backend tests reflect the new run traffic model.
2. Add workspace-level integration coverage for the new analysis traffic configuration.
3. Expose run traffic/sampling configuration through MCP.
4. Update the external `featbit-experimentation-skills` skill so agents know how to configure experiment traffic.
5. Decide and implement the layer management UI.
6. Remove the obsolete in-page Experiment coach.

## Current Findings

- Provider parity tests already cover the core run sampling stats path across PostgreSQL, MongoDB, and ClickHouse.
- Application controller tests now exercise the new run traffic model in the access-token flow.
- MCP now has a dedicated `featbit_release_decision_update_run_traffic` tool for run traffic/sampling configuration.
- The external skill at `C:\Code\featbit\featbit-release-decision-skills\skills\featbit-experimentation-skills` has been updated to describe the new run traffic model and MCP tool.
- The frontend now has per-run layer/sampling controls plus an MVP derived `/layers` view for layer visibility and overlap warnings.
- The right-side `Experiment coach` has been removed; `Coding-agent setup` is the supported agent path.
- Experiment audit activities now persist and display actor id/name/email/type for newly written entries.

## Priority Order

### P0 - Test Corrections And Safety Net

- [x] Update application integration tests that still send old `trafficPercent` / `trafficOffset` as the primary audience model.
- [x] Update verified snapshots affected by new run fields.
- [x] Add controller/API coverage for `assignmentUnitSelector`, `layerKey`, `layerTrafficPercent`, and `analysisSamplingPlan`.
- [x] Add `ReleaseDecisionMcpToolsTests` coverage for any new MCP run-traffic tool.
- [x] Add validation tests for malformed run sampling payloads:
  - [x] missing control/treatment variation
  - [x] include rate outside `0..100`
  - [x] invalid/empty assignment unit selector
  - [x] custom selector with missing event property excludes those events
- [x] Keep legacy allocation-plan tests where they prove backward compatibility, but mark them as legacy-path coverage.

### P1 - Workspace-Level Integration Scenario

- [x] Add a workspace-level integration test that creates/configures a real release-decision experiment run with the new traffic model.
- [x] Seed exposure and metric data for a realistic `90/10 flag -> 10/10 analysis` scenario.
- [x] Assert analysis output:
  - [x] `n` uses sampled control plus all treatment.
  - [x] metrics are joined only after first included exposure.
  - [x] guardrails produce non-zero treatment rows when data exists.
  - [x] SRM/sample checks match the expected analysis sample, not the raw flag split.
- [x] Decide whether this belongs in `Application.IntegrationTests` with a stronger test double, or in `Infrastructure.IntegrationTests` with real provider storage.
  - Implemented in `Infrastructure.IntegrationTests` provider parity because it verifies PostgreSQL, MongoDB, and ClickHouse against the same seeded event storage.

### P2 - MCP Run Traffic Tooling

- [x] Add a dedicated MCP tool, proposed name:
  - `featbit_release_decision_update_run_traffic`
- [x] Tool should update only analysis traffic fields:
  - `method`
  - `controlVariant`
  - `treatmentVariant`
  - `assignmentUnitSelector`
  - `layerKey`
  - `layerTrafficPercent`
  - `analysisSamplingPlan`
  - `audienceFilters`
- [x] Tool description must explain:
  - feature flag evaluation decides served variation
  - layer gates eligibility only
  - sampling happens inside actual served variation
  - `90/10 -> 10/10` means control include rate `11.111111`, treatment include rate `100`
- [x] Add server-side validation for the tool request before writing.
- [x] Return the refreshed experiment detail.
- [x] Decide whether user approval is required:
  - no for analysis config on a draft run
  - require `confirmedByUser: true` if the run is already collecting/analyzing/decided and the change would alter decision evidence

### P3 - External Agent Skill Update

Target:

`C:\Code\featbit\featbit-release-decision-skills\skills\featbit-experimentation-skills`

- [x] Update `SKILL.md` MCP Contract table to include the new run traffic tool.
- [x] Update CF-05 / CF-06 run management instructions to configure experiment traffic through MCP.
- [x] Replace old `trafficPercent` / `trafficOffset` / balanced sampling guidance with:
  - actual feature flag variation is source of truth
  - layer eligibility is optional mutual-exclusion gating
  - analysis sampling is per actual variation
  - assignment unit selector must match available event data
- [x] Update `references/workspace-experiment-folder-spec.md`.
- [x] Update `references/workspace-data-source-guide.md`.
- [x] Update `references/exposure-multi-experiment-traffic.md`.
- [x] Update `references/workspace-analysis-bayesian-usage-patterns.md` if it still implies equal-N trimming.
- [x] Keep feature-flag MCP approval guidance intact for real flag mutations.
- [x] Use `skill-forge` validation practices before considering the skill update done.

### P4 - Layer Management UX/API Design

Open design question: layer can be derived from runs today, but true mutual-exclusion management probably deserves an environment-level object.

Recommended direction:

- [ ] Add a lightweight Layer model:
  - `id`
  - `envId`
  - `key`
  - `name`
  - `description`
  - `assignmentUnitSelector`
  - `trafficPercent`
  - `createdAt`
  - `updatedAt`
- [ ] Add API endpoints for list/create/update/delete layers.
- [ ] Add MongoDB and PostgreSQL persistence and `v6.0.0` scripts.
- [x] Add a frontend module:
  - either a left sidebar item: `Layers`
  - or an Experimentation page tab: `Layers`
- [x] UI should show:
  - layer key/name
  - assignment unit
  - reserved traffic
  - runs using the layer
  - overlap/conflict warnings
- [x] Run traffic modal should allow selecting an existing layer instead of typing only free text.
- [ ] MCP should eventually expose layer read/list capability so agents can avoid inventing layer keys.

MVP alternative:

- [x] No new DB table yet.
- [x] Add a derived “Layers” view that groups existing runs by `layerKey`.
- [x] Allow copy/select existing `layerKey` from run traffic config.
- [x] Defer CRUD until multiple-experiment management is stable.

Implemented note:

- Added `/layers` as a derived dashboard page. It groups existing runs by `layerKey`, shows assignment units, active traffic, linked runs, and warnings for mixed assignment units / likely overlap.
- Did not add CRUD yet because current run-level `layerTrafficPercent` is an eligibility gate without explicit non-overlapping allocation ranges.

### P5 - Remove Experiment Coach

- [x] Remove `ChatPanel` from `experiment-detail-layout.tsx`.
- [x] Delete `chat-panel.tsx` if no longer referenced.
- [x] Remove any prompt/code paths that tell the user to use the local in-page coach.
- [x] Keep `Coding-agent setup`, because that is the path into `featbit-experimentation-skills`.
- [x] Rebalance layout after removing the right panel:
  - widen stage content
  - keep resizable panels only if still needed
  - remove dead CSS/imports

## Suggested Implementation Sequence

1. P0 tests and snapshots.
2. P2 MCP run traffic tool and tests.
3. P3 external skill update.
4. P1 workspace-level integration test.
5. P5 remove Experiment coach.
6. P4 layer management UX/API.

Reasoning:

- Tests and MCP contract should stabilize first because the external skill depends on them.
- Workspace-level integration should assert the whole stack after the API/MCP shape is settled.
- Removing Experiment coach is low-risk but should happen after the agent path is documented.
- Layer management is bigger product surface and should be designed after the basic MCP + skill workflow works.
