<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# FeatBit Release Decision Agent — Web UI

## Project Overview

This is a Next.js application that provides an interactive web UI for the **FeatBit Release Decision Agent**. It enables product managers, engineers, and data analysts to run data-driven experiments end-to-end — from defining intent to making release decisions — without needing a statistics background.

## Purpose

- **Experiment Management UI** — Create, view, and manage experiments through a visual dashboard.
- **Agent-Driven Experimentation** — Invoke the release decision agent via the UI to guide users through the full experiment loop: intent → hypothesis → implementation → exposure → measurement → interpretation → decision → learning.
- **Data Source Configuration** — Connect to databases, data warehouses, FeatBit instances, and other data sources to feed experiment metrics.
- **Real-Time Analysis** — View Bayesian analysis results, sample size checks, and statistical significance in the browser.
- **Decision Tracking** — Track experiment decisions (CONTINUE / PAUSE / ROLLBACK / INCONCLUSIVE) and learnings across iterations.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui (base-nova style)
- **Runtime**: React 19

## Architecture Conventions

- Use the App Router (`src/app/`) with file-based routing.
- Server Components by default; add `"use client"` only when the component requires browser APIs, state, or event handlers.
- Place reusable UI components in `src/components/`. shadcn/ui components live in `src/components/ui/`.
- Shared utilities go in `src/lib/`.
- Custom hooks go in `src/hooks/`.
- API routes go in `src/app/api/`.
- Use `@/*` import alias for all project imports.

## Key Directories

```
src/
  app/                 ← pages, layouts, API routes
  components/
    ui/                ← shadcn/ui primitives (button, card, dialog…)
  hooks/               ← custom React hooks
  lib/                 ← utilities, API clients, types
```

## Coding Standards

- Follow the `vercel-react-best-practices` skill conventions.
- Prefer Server Components and server-side data fetching.
- Use shadcn/ui components for all UI primitives — do not create custom equivalents.
- Keep components small and focused; extract logic into hooks or utilities.
- Use TypeScript strict mode; avoid `any`.

## UI Style Contract

Use `C:\Code\featbit\featbit-support` as the visual reference for layout rhythm, typography, surface treatment, and component density. Do not copy its blue theme color or sparkles-style mark into this app: keep this project's FeatBit green primary color and existing logo.

### Visual Language

- Default to light mode. Dark mode is supported, but light mode is the primary design target.
- Use Manrope for sans text and JetBrains Mono for code/technical values.
- Keep the app calm, spacious, and operational: soft fixed background gradients, translucent panels, clear borders, and restrained shadows.
- Prefer `glass-panel` for page-level hero/header blocks and `surface-panel` for lists, cards, tables, and loading/empty states.
- Avoid heavy decorative effects, saturated full-page gradients, oversized shadows, nested cards, or marketing-style hero layouts.
- Use 8-12px radii for panels and controls. Buttons, tabs, badges, and sidebar items should feel compact and dense.

### Typography

- Page H1: `text-3xl font-black tracking-tight`.
- Page subtitle/description: `mt-1 text-sm text-muted-foreground`.
- Section/card title: `text-base font-bold tracking-tight` or the local `CardTitle` default when enough.
- List item title: `text-[15px] font-bold tracking-tight`.
- Experiment stage body content: use `text-sm leading-relaxed` for field values, learning notes, rationale, and analysis status messages.
- Analysis tables: use at least `text-xs leading-relaxed` with `px-2 py-1` cells. Avoid `text-[10px]` for data tables, sample counts, conversion rates, or decision evidence.
- Metadata/help text: `text-xs text-muted-foreground`, with `font-medium` for chips or labels.
- Do not use negative letter spacing beyond Tailwind's normal `tracking-tight` utilities.

### Layout Patterns

- Main dashboard pages should sit in `mx-auto max-w-6xl` with `space-y-6` and modest page padding from the route layout.
- Page headers should be full-width content bands, usually `glass-panel flex flex-col gap-4 rounded-xl p-4 md:flex-row md:items-center md:justify-between`.
- Lists should prefer one `surface-panel overflow-hidden rounded-xl divide-y divide-border/70` wrapper instead of many detached decorative cards.
- Sidebar navigation should match the support hub density: 13px-ish labels, semibold text, active item with primary background, and a small workspace/theme block near the bottom.

### Component Rules

- Use existing shadcn/ui primitives from `src/components/ui` first.
- Buttons should remain compact, icon-led when possible, and only use strong shadowing for primary calls to action.
- Badges should be small, rounded, and information-dense. Do not create large pill-heavy status rows.
- Chat bubbles and agent panels should use the same `surface-panel` language: light borders, white/translucent surfaces, and modest rounded rectangles.
- Theme toggles should be explicit controls; in sidebars use the compact icon button paired with a `Theme` label.

## Metric Vocabulary & Fan-out Contract

Metric type/agg use a single canonical vocabulary across the whole repo. See
the root [AGENTS.md → Metric Vocabulary & Storage Layout](../../AGENTS.md) for
the full table. Locally in `modules/web`, the rules an agent must respect are:

### Canonical values only on writes

- `metricType`: `"binary" | "continuous"` — never `"numeric"`.
- `metricAgg`: `"once" | "count" | "sum" | "average"` — never `"last"`.
- Read paths (`parsePrimaryMetric`, `parseGuardrails`, `parseGuardrailDefs`) tolerate the legacy `"numeric"` spelling and normalise to `"continuous"`. Don't rely on this in new code.

### Setup-side writes MUST fan out to the latest run

The analysis route (`/api/experiments/[id]/analyze`) reads metric type/agg/guardrails from the **ExperimentRun** row, not the Experiment row. Any write to `Experiment.primaryMetric` or `Experiment.guardrails` must propagate to the latest run, otherwise the analyzer keeps using stale or default values.

Use `propagateMetricsToLatestRun(experimentId, fields)` from `lib/data.ts`. Existing call sites:

- `updateMetricsAction` in `lib/actions.ts` — Edit Metrics dialog
- `PUT /api/experiments/[id]/state` route handler — agent's `update-state`
- `saveExpertSetupAction` writes the run columns directly inside its own transaction (no helper needed)

When you add a new write site for the experiment-level metric JSON, you must call this helper too. When you add a new read site, prefer `parseGuardrailDefs` over splitting strings — it handles both the modern `GuardrailDef[]` shape and the legacy `string[]`.

### Run-side guardrails are GuardrailDef[], not string[]

`ExperimentRun.guardrailEvents` stores rich definitions:

```json
[{"event": "checkout_abandoned", "metricType": "binary", "metricAgg": "once", "inverse": false}]
```

The legacy bare `string[]` form is read-tolerated but never written. `analyze.ts` reads `metricAgg` and `inverse` from this column so guardrails analyse correctly even on the live track-service path (where the heuristic in `track-client.ts` cannot infer them from the response).

## Data Sources & Customer Endpoints

The analyse route (`/api/experiments/[id]/analyze`) branches on
`ExperimentRun.dataSourceMode` to decide where per-variant statistics come
from. Public contract:
[`docs/customer-managed-data-endpoints-v1.md`](docs/customer-managed-data-endpoints-v1.md).
Per-PR implementation history:
[`docs/customer-managed-endpoints-implementation.md`](docs/customer-managed-endpoints-implementation.md).

### `dataSourceMode` is a closed set

| Value                  | Source of stats                                                  | Required config                                  |
|------------------------|------------------------------------------------------------------|--------------------------------------------------|
| `featbit-managed`      | track-service (legacy default; what every existing run uses)     | `featbitEnvId`, `flagKey`                        |
| `customer-single`      | one Customer Managed Data Endpoint, all metrics in one call      | `customerEndpointConfig` = `{providerId, path, staticParams?}` |
| `customer-per-metric`  | per-metric routing, one call per `(provider, path)` group        | `customerEndpointConfig` = `{ "<event>": { providerId, path, staticParams? }, ... }` |
| `manual`               | totals pasted via Expert setup wizard, stored in `inputData`     | `inputData` JSON                                 |
| `external-text`        | free-text note only — analyser won't live-fetch                  | none                                             |

Default for new and pre-existing rows is `featbit-managed` (DB default
applied by migration `20260502000000_add_customer_endpoint_provider`).

### Same fan-out rule as the metric columns

Writes that originate at the experiment-level UI must propagate
`dataSourceMode` and `customerEndpointConfig` to the latest `ExperimentRun`.
The expert-setup wizard's `saveExpertSetupAction` writes them into the run
fields directly inside its own transaction; no helper needed. When a new
write site appears, follow the same pattern (or extend
`propagateMetricsToLatestRun`).

### Customer-mode failures do NOT fall back to stored data

When `dataSourceMode` is `customer-*`, a fetch failure from the customer
endpoint surfaces a 503 with the underlying error message. Falling back to
`inputData` would silently mask a misconfigured warehouse — operator chose
customer mode explicitly.

### HMAC signing format

Outbound calls to customer endpoints are signed in
`lib/stats/customer-endpoint-client.ts:signRequest`:

```
signing_string = `${X-FeatBit-Timestamp}.${rawBody}`
header         = `sha256=${hex(HMAC_SHA256(signingSecret, signing_string))}`
```

If a future outbound integration needs request signing, reuse this format
unless there's a strong reason not to.

### Stats-shape normalisation

The customer endpoint contract accepts either `{n, mean, stddev}`
(recommended) or `{n, sum, sum_squares}` (legacy) for continuous metrics.
`normaliseResponse` in `customer-endpoint-client.ts` converts both into the
`{n, mean, variance}` shape that `metricMoments()` in `bayesian.ts:51-53`
already consumes natively. Downstream code stays unchanged across all
shapes — never special-case the response shape outside the client.

### SSRF guard at the fetch layer

`checkPrivateAddress` in `customer-endpoint-client.ts` blocks loopback /
RFC1918 / link-local (incl. IMDS) / IPv6 ULA / non-`https://` schemes
before any outbound request. Documented limitation: no DNS-rebinding
defence in v1. Source comment on the function lists every blocked range
plus the dev-mode override flag.

## Sandbox0 Agent Ops

The chat panel runs against a sandbox0 (Managed Agents) custom agent that bundles repo-local skills. Operating it is two scripts:

```
npm run sandbox0:sync-skills      # upload skills/<name>/ → bump default agent version
npm run sandbox0:clear-sessions   # dry-run count
npm run sandbox0:clear-sessions -- apply   # null out experiment.sandbox_id
```

Why both: `sync-skills` POSTs new skill versions and bumps the default agent (e.g. v10 → v11), but every experiment's existing session is pinned to the agent version it was created with. To force everyone onto the new skills, run `clear-sessions -- apply` — the next chat-panel open per experiment creates a fresh session against the bumped agent.

`sync-skills` only **updates** existing sandbox0 skills; it never auto-creates from local folders. Onboarding a new skill is an explicit action via `sandbox0:setup-agent` (see `scripts/sandbox0/setup-agent.ts`).

## Relationship to Parent Project

This `agent/` folder is part of the [featbit-release-decision-agent](https://github.com/featbit/featbit-release-decision-agent) mono-repo. The parent project's `skills/` folder contains the agent skills that power the experiment loop. The web UI in this folder provides a visual interface for those same capabilities.
