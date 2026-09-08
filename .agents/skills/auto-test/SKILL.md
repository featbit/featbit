---
name: auto-test
description: Execute UI test procedures supplied in user prompts for FeatBit Experiments, Metrics, and Layers in the Aspire-hosted modules/front-end using Codex Computer Use. Use for acceptance and regression testing, checking visible outcomes, and reporting evidence. Fix bugs when the user also requests fixes.
---

# FeatBit Experimentation UI Auto Test

Execute the complete test procedure provided in the user's prompt against the real FeatBit front end running under Aspire. Use Codex Computer Use to operate the UI, verify each expected result, and produce a reviewable report. All reusable execution guidance is contained in this file; the user supplies the test cases, data, and expectations in the prompt.

## Read the user's procedure

- Treat the current prompt and subsequent user corrections as the test specification. Preserve step order, identifiers, inputs, expected outcomes, dependencies, and any requested stop-on-failure behavior.
- Identify the target project/environment, prerequisites, permitted data preparation, and cleanup requirements. Resolve references such as "the experiment just created" to the actual object from this execution.
- Proceed when the supplied information is sufficient. Ask only for missing information that prevents a meaningful next step, while continuing independent checks. If no procedure is supplied, request it and limit initial work to environment readiness.
- Use exact names and keys when specified. Otherwise, give new test objects a unique suffix such as `ui-auto-YYYYMMDD-HHmmss` and record their identities.
- Perform the local test mutations already authorized by the procedure without asking again before each save. Keep changes within the specified project, environment, and objects. Preserve test data and the running Aspire session unless cleanup is requested.

## Repository context

File paths below are relative to the repository root. Page routes use the current language prefix, such as `/en`.

| Scope | UI entry | Implementation |
| --- | --- | --- |
| Experiments | Release Decision > Experiments; `/:lang/experiments` | `modules/front-end/src/features/expts` |
| Experiment details and runs | Open an experiment; `/:lang/experiments/:experimentId` | `modules/front-end/src/features/expts/details` |
| Metrics | Release Decision > Metrics; `/:lang/metrics` | `modules/front-end/src/features/expt-metrics` |
| Layers | Release Decision > Layers; `/:lang/layers` | `modules/front-end/src/features/expt-layers` |

- Interact with Feature Flags, projects, and environments when the supplied procedure requires them.
- Read `.aspire/README.md` for runtime configuration, resource names, and local login details. The root `aspire.config.json` points to `.aspire/FeatBit.AppHost.csproj`.
- The test target is Aspire resource `ui`, which runs `modules/front-end`. Resource `release-decision-web` runs the comparison implementation in `modules/front-end-rda-tempo`; use it only for requested comparisons or diagnosis. Both UIs share the API and database.
- Historical screenshots provide context. Discover current URLs and UI controls instead of reusing screenshot ports, project names, or coordinates.

## Connect to Aspire

Discover the existing session from the repository root:

```powershell
aspire ps --non-interactive
aspire describe --format Json --non-interactive
```

1. Identify this repository's AppHost and its current `ui` and `api-server` endpoints. Reuse a session started with either `aspire run` or `aspire start`; keep the terminal hosting `aspire run` open.
2. If the stack is stopped, follow `.aspire/README.md` and the available Aspire skill to start the required local topology. Prefer `aspire start --non-interactive` for background operation. Avoid restarting a healthy stack or starting separate Vite/API processes.
3. Wait for the required resources before interacting with them:

   ```powershell
   aspire wait api-server --non-interactive
   aspire wait ui --timeout 600 --non-interactive
   ```

   Use asynchronous command execution or short output polls for long waits, and keep the user informed of progress.
4. Ordinary management-UI tests do not require `evaluation-server`. For SDK assignment, exposure, event ingestion, or analysis scenarios, check the procedure's required services and data source. Resource readiness alone does not establish that experiment data exists.
5. If discovery fails, inspect Aspire output, resource logs, or the Dashboard. Request a missing endpoint only when it cannot be discovered; never guess a port or claim blocked UI steps were executed.

## Execute through Computer Use

1. Read the available Computer Use tool instructions and applicable skill before initializing the browser session. Use only the APIs exposed by the current runtime. If `mcp__cua_repl` is available, follow its documented browser initialization and control interfaces.
2. Respect a user-selected browser or tab. Otherwise, select or open the current Aspire `ui` endpoint. Verify the URL, FeatBit page, login state, and the organization/project/environment shown in the page header before making changes.
3. For each step: observe the current UI, locate the intended control, perform the action, wait for its visible result, check the expected outcome, and record evidence. Use the tool's supported accessibility, DOM/semantic, or screenshot controls.
4. Locate repeated buttons within the correct row, form, or dialog. Confirm the target field before typing and the selected value after choosing an option. Refresh observations after navigation, scrolling, modal changes, or list updates; coordinates and element references must come from current observations.
5. Wait for meaningful conditions such as loading completion, a closed dialog, a changed value, or a validation message. Use a bounded timeout appropriate to the operation; ordinary interactions can default to 30 seconds unless the procedure specifies otherwise.
6. After a timeout or tool error, observe again to determine whether the action completed before retrying. Avoid duplicate creates, run starts, decisions, or deletes. Record the first outcome and any retries rather than hiding failures behind a successful retry.
7. Use visible results to establish UI assertions. For persistence checks, refresh or reopen the object and verify saved values; a success toast alone is insufficient. For negative cases, verify the expected error and absence of an invalid saved change without correcting the intentionally invalid input.

The requested UI operations must be performed through Computer Use. Do not substitute API calls, database writes, browser script injection, or application-state manipulation for a tested UI action. Playwright/Vitest results, builds, and source inspection can supplement diagnosis but cannot establish that the Computer Use procedure passed.

Use shell tools for reading files, Aspire operations, diagnostics, and reporting. Use API runners or traffic generators only for setup or data generation authorized by the procedure, recording that work separately from UI assertions. If using `integration-tests/experiment-e2e`, read its instructions and explicitly select the local endpoints; its runner can create or modify many objects and defaults to remote service URLs.

If browser access or login requires user intervention, record the specific blocker and continue independent work. Do not silently switch to a different test method.

## Verify experimentation behavior

Apply the assertions from the prompt, using these distinctions where relevant:

- Check the exact experiment, flag, metric, layer, and selected run. Distinguish a list's business Stage from the active details tab and from an individual run's state.
- Stage and analysis results can depend on observation windows, decisions, learning records, and available samples. Record the current time, timezone, and relevant window for time-dependent checks.
- Distinguish layer allocation, variant weights, and sampling percentages. Correct UI configuration alone does not verify actual SDK traffic assignment.
- Check filters and pagination to the extent required by the procedure; observing one page does not establish that the full result set is correct.
- Treat empty charts, missing samples, and incomplete analysis according to the expected outcome. When required data is unavailable and its generation is not authorized, mark dependent steps blocked rather than inventing statistical conclusions.
- Use source code and the comparison UI to explain observed behavior when needed. They do not override the user's expected result or independently prove correctness.

## Failures, optional fixes, and reporting

- Capture the failing action, expected versus actual behavior, object identity, and page evidence before investigating. Distinguish product failures from missing test data, environment problems, and tool failures.
- Mark steps that depend on a failed prerequisite as blocked and continue independent cases unless the user requested stopping. Use supported browser diagnostics and Aspire logs as needed, separating confirmed facts from suspected causes.
- Default to testing and reporting. When the user also requests fixes, follow `.agents/skills/debug-expt/SKILL.md` and applicable `AGENTS.md` instructions, run checks appropriate to the change, and replay the failed UI flow through Computer Use. Preserve the original failure and the post-fix result separately.
- Update `report.md` as cases complete. Unless the user specifies another location, use the existing ignored directory `integration-tests/experiment-e2e/reports/<session-id>/`. Keep this execution's session ID distinct from product experiment/run IDs.
- Record the procedure source, execution time/timezone, code version and relevant uncommitted changes, UI URL, project/environment, prerequisites, assumptions, object names/keys/available IDs, data preparation, retries, and cleanup.

Account for every supplied step:

| Case / step | Action and inputs | Expected | Observed | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| Original identifier | Actual operation and target | Prompt assertion | Visible value or behavior | PASS / FAIL / BLOCKED / SKIPPED | Screenshot or observation reference |

`PASS` means the action was executed and its assertion was satisfied. `FAIL` means observed behavior contradicted the expectation. `BLOCKED` means a prerequisite, environment, or tool prevented completion. `SKIPPED` means the step was deliberately not executed, with a stated reason. Unexecuted steps never count as passing.

Capture real screenshots or page-state evidence at failures and important checkpoints. Save screenshots when the tool supports export; otherwise record available observation identifiers and visible details, stating that limitation. Never invent screenshot files or links. Keep passwords, tokens, and SDK secrets out of reports.

Finish with status counts, reproducible failures, blockers, and links to the report and retained test objects. State verification limits explicitly, including when required steps remain unverified.
