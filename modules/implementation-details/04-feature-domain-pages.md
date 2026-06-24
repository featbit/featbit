# 04 - Feature Domain Pages

## Goal

Migrate the main product domains page by page while preserving backend API contracts and improving the user experience with the new React UI system.

## Migration Order

1. Feature Flags
2. End Users
3. Segments
4. Experiments
5. Audit Logs
6. Workspace
7. Organization
8. Relay Proxies
9. IAM
10. Integrations

## Feature Flags

- Implement list, create, detail, archive/restore, delete, toggle, tags, variations, targeting, history, settings, and pending changes entry points.
- List page must include summary, environment status, search, filters, copyable key pill, action menu, and bulk action bar.
- Detail page must use a sticky header with on/off state, key, tags, pending changes, Save, Review/Schedule/Change Request actions, and tabs.

## End Users

- Implement searchable/filterable user list.
- Preserve user detail fields, customized properties, flag evaluation/targeting-related views, and segment relationships.
- Use TanStack Table with server-side pagination/sorting/filtering where the API supports it.

## Segments

- Implement list, create/edit drawer or page, rule builder, included/excluded users, and segment detail.
- Share rule-building utilities with feature flag targeting where possible.

## Experiments

- Implement experiment list and detail views using Recharts for insights/trends.
- Do not migrate G2.
- Use shadcn/chart-style wrappers for consistent tooltip, legend, and token behavior.

## Audit Logs

- Implement filters by actor, resource, action, date range, and environment/project context.
- Provide a readable diff/detail view for log entries.

## Workspace And Organization

- Workspace: migrate settings, members/global users, projects, environments, secrets, and detailed billing/subscription/license/plan-related views.
- Organization: migrate organization profile and organization-level settings that are not billing/subscription.
- Keep destructive actions behind confirmation flows.

## Relay Proxies

- Implement list, create/edit, secret display/copy, status, and delete flows.
- Keep it under Admin navigation, not Workspace grouping.

## IAM

- Implement Team, Groups, and Policies.
- Centralize policy editor behavior and permission previews.
- Menu visibility and actions must use the shared permission helpers.

## Integrations

- Implement Webhooks and Access Tokens.
- Include test webhook flow, token creation/copy-once behavior, rotation/revoke/delete, and permission checks.

## Acceptance Criteria

- Each domain has list, empty, loading, error, create, edit, and destructive-action states.
- API calls use the shared typed client and current context headers.
- High-risk actions have confirmation and clear feedback.
- Pages are usable in both `/en` and `/zh` routes.
