---
name: debug-expt
description: Debug and fix FeatBit experimentation UI bugs, missing functionality, and migration regressions in modules/front-end. Use when investigating experimentation behavior migrated from modules/front-end-rda-tempo, including reproduction and verification through the repository's Aspire stack.
---

# Debug FeatBit Experimentation

Resolve the user's reported issue in the experimentation module, using the prior implementation and the running Aspire environment to understand and verify the expected behavior.

## Repository context

All paths below are relative to the repository root.

- Current implementation: `modules/front-end`, primarily `src/features/expts`.
- Migration reference: `modules/front-end-rda-tempo`. Compare the relevant workflow when diagnosing missing functionality or regressions; adapt fixes to the current application's architecture and UI conventions.
- Local runtime and observability: `.aspire/`, configured by the root `aspire.config.json`. Read `.aspire/README.md` for topology, resource names, and runtime instructions.
- Read `modules/front-end/AGENTS.md` and any applicable nested guidance before editing. Read the reference project's guidance if working there.

## Workflow

1. Identify the affected page or action, actual behavior, and expected behavior from the user's report. Ask for missing reproduction details only when they prevent useful investigation. If no issue is supplied, ask what needs fixing rather than starting a broad migration audit.
2. Locate the relevant experimentation components, routes, hooks, and API calls. Compare the corresponding behavior in `modules/front-end-rda-tempo` where helpful. Treat the user's requirements and current API contracts as authoritative when the implementations differ.
3. Reuse the existing Aspire session. Verify its current status and discover endpoints from the repository root:

   ```powershell
   aspire ps
   aspire describe --format Json --non-interactive
   ```

   Use the reported `ui`, `release-decision-web`, and `api-server` endpoints as needed. Use `evaluation-server` only when the issue involves evaluation or SDK behavior and that resource is enabled. Inspect browser errors, network responses, and relevant Aspire logs or traces to connect the symptom to its cause.

   Do not assume a saved URL or a previous session is still valid. If tools cannot discover the necessary dashboard or service URL, ask the user for that endpoint while continuing source-level investigation. If the stack is stopped, follow `.aspire/README.md` and the available Aspire skill for startup. Avoid restarting a healthy stack just to discover its URLs.
4. Fix the cause in `modules/front-end`, extending into related backend code only when the diagnosis requires it. Preserve the current application's routing, state management, shared UI, and localization conventions. Keep changes focused on the reported issue; use the migration source as a reference rather than copying framework-specific code wholesale.
5. Verify the affected behavior with the narrowest useful checks supported by `modules/front-end/package.json` and the repository guidance. Use type checking for TypeScript changes and relevant existing tests; add a regression test when it meaningfully captures the bug. Reproduce the original UI flow against Aspire when browser access is available. A successful build alone does not establish that a runtime bug is fixed.

## Completion

Report the cause, the changes made, and the checks performed. State any remaining reproduction or verification limits explicitly, including unavailable services or browser access.
