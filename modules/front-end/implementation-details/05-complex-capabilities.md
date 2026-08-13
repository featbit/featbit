# 05 - Complex Capabilities

## Goal

Migrate complex shared product capabilities that cut across multiple feature domains.

## Feature Flag Targeting And Rules

- Build a React `RuleBuilder` that makes IF/AND/SERVE structure explicit.
- Support rule reorder, clause add/remove, operator selection, value editing, percentage rollout, and variation assignment.
- Show inline validation and pending-change markers.
- Keep rule utility functions covered by unit tests.

## Change Review And Pending Changes

- Implement `PendingChangesDrawer` and related state.
- Users must be able to review unsaved changes, save immediately, request review, or schedule changes where supported by existing APIs.
- Sticky page actions must always show whether there are unsaved or pending changes.

## Policy Editor

- Build a structured IAM policy editor instead of free-form JSON only.
- Include resource finder, action picker, effect selection, validation, and preview.
- Keep JSON view/export if the current product needs it, using the shared CodeMirror 6 structured editor for editing and `CodeBlock` for read-only snippets.

## Resource Editor And Finder

- Implement reusable `ResourceSelector` and resource finder components for IAM, audit logs, and policy editing.
- Support search, type filtering, keyboard navigation, and copyable resource identifiers.

## Structured Editor

- Use CodeMirror 6 as the only embedded editor in the React implementation.
- Do not include Monaco Editor, `@monaco-editor/react`, Monaco workers, or copied Monaco assets.
- Cover the current Angular Monaco use cases with CodeMirror extensions:
  - feature flag JSON/string variation editing and read-only viewing
  - webhook JSON Handlebars payload template editing
  - formatting, copy, reset, read-only mode, validation, and accessible keyboard behavior
  - `@@flag.name` and `@@flag.description` completions in webhook payload templates
- Keep validation and formatting project-owned where possible, using JSON parsing, Handlebars test payload rendering, Zod schemas, or lightweight helper functions rather than depending on Monaco language services.

## Code Blocks

- Do not migrate Prism.
- Use a shared `CodeBlock` for SDK examples, JSON snippets, curl commands, and short code samples.
- Use Shiki for multi-language or complex highlighting.
- Include copy button, language label, optional line wrap, and light/dark token compatibility.

## Charts

- Do not migrate G2.
- Use Recharts with shadcn/chart-style wrappers:
  - `ChartContainer`
  - `ChartTooltip`
  - `ChartLegend`
- Use line, bar, area, and composed charts for experiments, insights, and trends.

## Acceptance Criteria

- Complex components are reusable across domains rather than embedded in one page.
- Targeting, IAM policy, resource selection, code display, JSON editing, and charts have focused unit/component coverage.
- Heavy libraries are lazy-loaded where practical.
