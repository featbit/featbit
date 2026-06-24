# 02 - Core Infrastructure

## Goal

Build the shared runtime layer used by every migrated page: env loading, typed API access, auth/session state, current context stores, permission helpers, and base UI building blocks.

## Runtime Env

- Load runtime config from `window.env`, preserving the existing `assets/env.template.js` and `assets/env.js` semantics.
- Provide a typed `getRuntimeEnv()` helper with normalized URL values and clear defaults for local development.
- Keep the env keys compatible with the Angular deployment model.
- Include `VERSION` / `window.env.version` in the typed runtime env. Default it to `dev` when not provided, matching the local `feat/show-current-version` branch behavior.

## API Client

- Implement a typed API client around `fetch` or a small wrapper, not Angular-era patterns.
- Every authenticated request must include:
  - `Authorization: Bearer <token>`
  - `Organization: <currentOrgId>` when available
  - `Workspace: <currentWorkspaceId>` when available
- Automatically unwrap successful FeatBit `IResponse.data` responses.
- Preserve the original error semantics:
  - show user-facing error toast for API failures where appropriate.
  - handle 401 with a single refresh-token queue shared by concurrent requests.
  - if refresh fails, clear local session state and redirect to `/login`.
- Keep API types close to backend DTOs and avoid page-specific response reshaping in the client layer.

## Stores

- Implement small focused stores for:
  - auth/session
  - current organization
  - current workspace
  - current project
  - current environment
  - license/plan state
- Preserve localStorage key compatibility where current Angular behavior depends on it.
- Separate server state in TanStack Query from client UI state in local stores.

## Permissions And License

- Centralize permission checks in `lib/permissions`.
- Expose helpers for route guards, menu visibility, button disabled states, and destructive action checks.
- Keep license/plan checks separate from IAM permission checks.

## Base Components

Implement reusable base components before page migration:

Shell-related components must follow the authenticated console shell design contract in [react-console-design.md](../design/react-console-design.md), using [react-console-light.png](../design/react-console-light.png) and [react-console-dark.png](../design/react-console-dark.png) as the visual baselines for header/context bar, sidebar, account menu, subscription/license badge, spacing density, border treatment, typography scale, and light/dark shell behavior. Page-specific content components such as Feature Flags tables and editors still need separate product-page designs.

- `PageShell`
- `PageHeader`
- `ContextBar`
- `SidebarNav`
- `DataToolbar`
- `DataTable`
- `StatusBadge`
- `CopyableCode`
- `EnvironmentBadge`
- `ConfirmAction`
- `EntityDrawer`
- `EmptyState`
- `PendingChangesDrawer`
- `RuleBuilder`
- `ResourceSelector`

## Acceptance Criteria

- API client unit tests cover unwrap, error handling, auth headers, and refresh-token queue behavior.
- Stores can restore current context from localStorage and update it without reloading the app.
- Permission helpers are usable from routes, menus, and action buttons.
- Base components use shadcn/ui defaults and do not copy Angular/ng-zorro styling.
- Base shell components visually align with the saved React console shell design assets in both light and dark mode.
