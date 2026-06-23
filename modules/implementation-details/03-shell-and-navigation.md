# 03 - Shell, Login, And Navigation

## Goal

Migrate the application shell: login, auth guard, secure layout, side navigation, top header, locale switcher, and workspace/org/project/env switching.

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

- Use a left navigation plus top context bar layout.
- Keep Organization, Project, Environment, Plan, and User context visible at the top.
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

- Provide searchable switchers for workspace, organization, project, and environment.
- Environment entries should include a colored dot for dev/staging/prod-style distinction.
- Context changes must update local stores, invalidate relevant TanStack Query caches, and navigate safely when the current route depends on unavailable context.

## Acceptance Criteria

- Users can login, select workspace, complete onboarding, and reach the secure shell.
- Menu visibility respects permissions.
- Language switching preserves the equivalent path when possible.
- `/en/*` and `/zh/*` deep links survive browser refresh.
