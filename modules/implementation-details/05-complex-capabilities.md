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
- Keep JSON view/export if the current product needs it, using Monaco or `CodeBlock` as appropriate.

## Resource Editor And Finder

- Implement reusable `ResourceSelector` and resource finder components for IAM, audit logs, and policy editing.
- Support search, type filtering, keyboard navigation, and copyable resource identifiers.

## Monaco JSON Editor

- Use Monaco only where actual structured JSON editing is required.
- Lazy-load Monaco so it does not increase the initial bundle unnecessarily.
- Provide validation, formatting, copy, reset, and read-only modes.

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
