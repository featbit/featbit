# 03 - Shell, Login, And Navigation

## Goal

Migrate the application shell: login, auth guard, secure layout, side navigation, top header, top-right subscription/license badge, left-bottom account menu with current version display, theme and locale controls, and workspace/org/project/env switching.

## Routes

- Preserve language-prefixed routes with `/en/*` and `/zh/*`.
- Redirect `/` based on browser language, matching the current Nginx/browser-language behavior.
- Public routes:
  - `/:lang/login`
  - `/:lang/onboarding`
  - `/:lang/select-workspace`
- Authenticated routes live under the secure shell and keep the same functional destinations as Angular.

## Login

- Fully redesign the login page.
- Do not copy the old Angular login background or old illustration card.
- Use [the saved login concept and design rationale](../design/login-page-design.md) as the reference direction.
- Use [the saved SSO login concept and design rationale](../design/sso-login-page-design.md) for the `Sign in with SSO` flow.
- Use a restrained split layout:
  - header with current Angular FeatBit logo style, language switcher, and header-bottom divider.
  - left area with feature rollout / traffic split abstraction, not a console preview and not AI messaging.
  - right authentication column with email/password login, Google/GitHub OAuth, and a separate Enterprise SSO section.
- Keep a vertical divider between the left visual area and right login column.
- Do not add a footer divider line.
- Do not place checkmark, success, verified, or tick icons in the right login area.
- The SSO page should ask for `Workspace key`, use a placeholder such as `acme-prod`, and include only `Back to sign in` plus `Continue with SSO`; do not include Google/GitHub, email/password fields, `Use email and password instead`, or SAML/OIDC helper text.
- Preserve existing backend login behavior and session persistence.

## Secure Shell

- Implement the authenticated shell according to [react-console-design.md](../design/react-console-design.md), with [react-console-light.png](../design/react-console-light.png) and [react-console-dark.png](../design/react-console-dark.png) as required visual baselines. These assets govern shell layout only; the Feature Flags content shown inside the shell is a placeholder and not final page design.
- Use a left navigation plus top context bar layout.
- Implement sidebar collapse/expand:
  - expanded sidebar shows the FeatBit mark + wordmark.
  - expanded sidebar shows a `PanelLeftClose` icon button near the sidebar/content divider.
  - collapsed sidebar becomes an icon rail, shows only the FeatBit mark, hides section labels and item text, and shows tooltips on hover.
  - collapsed sidebar uses a `PanelLeftOpen` icon button to restore the expanded state.
  - collapsed Account entry shows only user initials or a generic user icon with a tooltip.
  - persist the state in localStorage, for example `featbit:sidebar-collapsed`.
- Keep Organization, Project, and Environment visible as the only primary context path in the top bar, for example `Acme Corp / Growth Platform / Production`. Do not include a `FeatBit` root crumb or plan information in the context path. Do not include a user avatar, theme switcher, or language switcher in the top-right header.
- Show a richer, clickable subscription/license badge in the top-right header. Follow the Angular implementation's information model:
  - SaaS Free plan: `Free Plan` / `Upgrade Now`.
  - Expired license: `License Expired` / `<plan name>`.
  - Expiring license: `Expiring in N days` / `<plan name>`.
  - Active paid license: `Current Plan` / `<plan name>`.
  - Missing license/plan data: `Upgrade Now` / `Get Enterprise`.
- Clicking the subscription/license badge should navigate to Workspace billing/subscription settings. Free plan should open the pricing/upgrade flow; paid/license states should open the license or subscription detail page.
- Use the left-bottom Account button as the single authenticated identity and preference entry point. FeatBit does not support configurable user avatars, so show the user's name/email with an initial or generic user icon only.
- Put `Light`, `Dark`, and `System` theme switching inside the Account menu. The control should use the shadcn-style `ThemeProvider` / `useTheme` pattern, persist user preference, and update the document theme without requiring a route refresh.
- Put language switching inside the Account menu for authenticated routes.
- Do not show subscription/plan information in the Account menu; the top-right subscription/license badge is the only plan summary entry.
- Show the current app version in the Account menu. Follow the local `feat/show-current-version` branch: read the value from runtime env `window.env.version`, default to `dev`, display it as `Version: <version>`, and optionally link the row to `https://github.com/featbit/featbit`.
- Implement auth guard behavior:
  - unauthenticated users go to login.
  - users without selected workspace go to select-workspace.
  - users requiring onboarding go to onboarding.

## Navigation

Use these groups:

- Get Started
- Release
  - Feature Flags
  - Segments
  - End Users
- Experimentation
  - Experiments
  - Metrics
- Governance
  - Audit Logs
  - future Change Requests
- Admin
  - Workspace
  - Organization
  - IAM
  - Relay Proxies
  - Integrations

IAM sub-items:

- Team
- Groups
- Policies

Integrations sub-items:

- Webhooks
- Access Tokens

## Context Switchers

- Provide searchable switchers for workspace and organization.
- Provide a combined project/environment switcher in the top context bar. The current environment opens a shadcn `Popover` + `Command` search over all projects and environments in the current organization.
- Group environment results by project. Each environment entry should include the project name, environment name, a colored dot for dev/staging/prod-style distinction, and a check icon for the selected project/environment pair.
- Selecting an environment from another project must update both current project and current environment stores and localStorage.
- Context changes must invalidate relevant TanStack Query caches for `projectId` and `envId`, and navigate safely when the current route depends on unavailable context.

## Acceptance Criteria

- Users can login, select workspace, complete onboarding, and reach the secure shell.
- The authenticated shell matches the saved React console design contract for layout, spacing density, typography scale, sidebar behavior, context bar, subscription/license badge, account menu, and light/dark styling.
- Menu visibility respects permissions.
- Sidebar collapse/expand works, persists across reloads, and provides tooltips for collapsed navigation items.
- The authenticated top-right header does not show a user avatar, theme switcher, or language switcher.
- The top-right subscription/license badge displays Free, active, expiring, expired, and missing-license states correctly.
- The left-bottom Account menu is the single account/preference entry and does not duplicate subscription/plan information.
- The account menu displays the current version from runtime env and falls back to `dev` when unset.
- Theme switching works in login and authenticated shell routes, persists across reloads, and does not break language-prefixed routes.
- Language switching preserves the equivalent path when possible.
- `/en/*` and `/zh/*` deep links survive browser refresh.
