# Workspace Page Design

This document defines the React design target for the Workspace admin area. Angular remains the functional reference, but React should use the new authenticated layout, shadcn/ui primitives, Tailwind tokens, lucide-react icons, TanStack Query/Table, React Hook Form + Zod, and Recharts. Do not copy the Angular/ng-zorro layout or visual styling.

## Scope And Boundaries

This design document covers only the Workspace page content area inside the authenticated layout.

- Implementing this page must not modify authenticated layout primitives such as the context bar, sidebar navigation, account menu, top-right subscription/license badge, layout spacing contract, or route-level layout frame.
- The context bar, navigation, sidebar, account entry, and subscription/license badge shown in the design image are layout context only. They are included so the Workspace page can be judged in place, not because this page owns them.
- Workspace implementation work should be limited to the route family and content described below: page header, tabs, tab content, forms, tables, charts, drawers, modals, loading states, empty states, and permission/license-gated states.
- If implementation requires a reusable layout primitive change, stop and update the layout design contract first instead of changing it as part of Workspace page work.

## Design Assets

- General tab light theme concept: [workspace-page-general-light-v2.png](workspace-page-general-light-v2.png)
- General tab dark theme concept: [workspace-page-general-dark.png](workspace-page-general-dark.png)
- License tab light theme concept: [workspace-page-license-light-v5.png](workspace-page-license-light-v5.png)
- License tab dark theme concept: [workspace-page-license-dark.png](workspace-page-license-dark.png)
- License tab SaaS light theme concept: [workspace-page-license-saas-light-v3.png](workspace-page-license-saas-light-v3.png)
- License tab SaaS dark theme concept: [workspace-page-license-saas-dark.png](workspace-page-license-saas-dark.png)

## Angular Functional Reference

Angular exposes Workspace as an Admin navigation entry with these tab-level areas:

- Workspace: edit workspace name and key; edit OIDC SSO settings when the license grants SSO and the user has permission.
- License: copy Workspace Id, update a self-hosted license, and show license details or a no-license notice.
- Usage: select a billing/usage period, view unique users, flag evaluations, and custom metrics, inspect daily trends, and compare usage by environment.
- Billing: SaaS-only subscription and invoice area, including checkout return state when `payment_status` is present.
- Global Users: license-gated global end-user table with search, display columns, import, evaluate, and detail actions.

Permission and license behavior from Angular should be preserved:

- License tab remains visible, but update actions are disabled or explained when `UpdateWorkspaceLicense` is not granted.
- SSO settings render only when the license grants SSO and the user can update workspace SSO settings.
- Global Users is gated by the Global User license feature.
- Billing appears only in SaaS hosting mode.

## React Information Architecture

Route family:

```text
/:lang/workspace
/:lang/workspace/license
/:lang/workspace/usage
/:lang/workspace/billing
/:lang/workspace/global-users
```

The Workspace entry should open inside the authenticated layout under Admin. The page body should not introduce another left navigation. Use a compact page header plus horizontal tabs.

Page header:

- Title: `Workspace`
- Subtitle: current workspace name and key in a muted inline form, for example `Acme Workspace - acme`
- Do not show page-level action buttons in the Workspace header. Keep license and workspace ID actions inside their relevant tabs.
- Keep the top application context bar unchanged; it remains `Organization / Project / Environment` only.

Tabs:

- `General`
- `License`
- `Usage`
- `Billing` when SaaS
- `Global Users`

Use shadcn-style tabs with a bottom border. Keep tab density compact and avoid wrapping at normal desktop widths. On narrow widths, allow horizontal scrolling rather than stacking the tabs.

## General Tab

The General tab replaces Angular's simple vertical form with a more structured settings page:

- Section: `Workspace identity`
  - Fields: `Name`, `Key`
  - Use React Hook Form + Zod validation.
  - Validate required fields locally.
  - Validate key uniqueness asynchronously with debounce, except when unchanged.
  - Save button is aligned with the form footer, not floated.
  - Disable save if the user lacks `UpdateWorkspaceGeneralSettings`; show a small permission note near the footer.
- Section: `Single sign-on`
  - Render only when SSO is licensed and permission allows SSO settings.
  - Fields: `Client ID`, `Client secret`, `Token endpoint`, `Client authentication method`, `Authorization endpoint`, `Scope`, `User email claim`.
  - Client secret uses a password field with a reveal icon button.
  - Endpoint fields should use URL-like validation where backend compatibility allows it; keep backend validation as source of truth.
  - Use a separate save action for SSO settings.

Layout:

- Use two full-width sections with a constrained form width, roughly `max-w-3xl`.
- Sections are not nested cards. Use white/card surfaces only where the layout background needs separation; otherwise use border-bottom section dividers.
- Keep helper text concise and operational. Do not add marketing copy.
- Implement both light and dark themes according to the referenced General tab design assets. Dark mode must preserve the same structure, spacing, and alignment as light mode while using neutral dark surfaces, low-contrast borders, readable foreground text, muted secondary text, and the same semantic blue/green accents.

States:

- Loading: skeleton rows matching form fields.
- Saving: button spinner or disabled button with `Saving`.
- Success: toast `Operation succeeded`.
- Error: inline field error when field-specific; toast for request failure.

## License Tab

The License tab should serve both self-hosted and SaaS contexts while respecting the subscription badge behavior in the layout.

The License tab design targets are [workspace-page-license-light-v5.png](workspace-page-license-light-v5.png) and [workspace-page-license-dark.png](workspace-page-license-dark.png). Generate code strictly according to those images for light and dark theme page structure and spacing. The page header must remain free of page-level action buttons; workspace ID copy and license update actions belong inside this tab.

Content order:

1. Workspace ID
2. License key
3. License status
4. Licensed features

`License status` should be visually grouped with license details, placed directly above `Licensed features`, and not placed at the top of the License tab.

Top summary:

- Show current plan/license status using a compact status row:
  - Current plan
  - Status
  - Issued at
  - Expiration or renewal date when known
  - Licensed features count or notable missing feature state
- Use a single bordered summary row with four compact columns in light theme: `Current plan`, `Status`, `Issued at`, and `Expires`.
- Use a green `Active` badge only for an active license; keep other text and borders neutral.

Workspace ID:

- Show Workspace Id in a read-only monospace copyable code row. It must not be editable and must not look like a standard text input.
- Use a copy icon button with tooltip `Copy workspace ID`.
- Include helper text only where useful: `Required when generating a self-hosted license.`
- The copy action is a compact inline action at the right edge of the Workspace ID row, not a page header action.
- Use a muted read-only background and a lock/read-only icon where it fits to communicate that the value cannot be changed.

Self-hosted license update:

- Render license input/update only when not SaaS.
- Use a textarea or long input that can handle pasted license strings.
- Keep update behind `UpdateWorkspaceLicense` permission.
- Align `Update license` to the license key section footer. Do not duplicate it in the Workspace page header.
- Include a muted permission note near the footer: `Only workspace administrators can update license keys.`

SaaS license view:

- Use [workspace-page-license-saas-light-v3.png](workspace-page-license-saas-light-v3.png) and [workspace-page-license-saas-dark.png](workspace-page-license-saas-dark.png) as the SaaS License tab design targets.
- Do not show Workspace ID copy UI in the SaaS License tab.
- Do not show the self-hosted license key textarea or `Update license` action in the SaaS License tab.
- Do not show subscription details, renewal details, seat counts, invoices, or `Manage billing` in the SaaS License tab. These belong in the Billing tab.
- Start the SaaS License tab content with `License status`, followed by `Licensed features`.
- The SaaS `License status` section should show `License source`, `Status`, `Issued at`, and `Expires`.

License detail:

- Replace the Angular license card with a shadcn-styled details panel using neutral status badges.
- If no license is available, show an info alert with a link to the FeatBit dashboard.
- On wide screens, keep the lower license details area composed and avoid stretching feature rows across the full viewport. Use a constrained detail area or balanced internal grid as shown in the design asset.
- Keep the lower license details area left-aligned with the rest of the License tab content. Do not center or indent the `License status` and `Licensed features` sections relative to `Workspace ID` and `License key`.
- Show granted features as compact feature tiles with check icons, feature names, one-line descriptions, and `Granted` badges.
- Use a three-column feature tile grid on wide screens, collapsing to two columns and then one column as space narrows.

## Usage Tab

The Usage tab should feel like an operational analytics page, not a decorative dashboard.

Toolbar:

- Left: period selector with options matching Angular behavior, such as current month, last 7 days, and last 30 days.
- Right or inline: selected date range as muted text.

Summary metrics:

- Three compact metric cards:
  - Unique Users
  - Flag Evaluations
  - Custom Metrics
- Each card shows value, percent change, and comparison label.
- Use semantic color carefully: green for positive, destructive/red for negative, neutral when unchanged or unavailable.

Daily trend:

- Use Recharts, not G2.
- Metric selector should be a segmented control.
- Show one chart at a time with consistent tooltip and legend styling.
- Empty data should show a quiet empty state inside the chart area.

Per environment table:

- Use TanStack Table.
- Columns: Environment, Unique Users, Flag Evaluations, Custom Metrics.
- Environment cell shows `Organization / Project` as secondary text and environment name as primary text.
- Metric cells show value, share percentage, and a small horizontal progress indicator.
- Support sorting by metric columns.

## Billing Tab

Billing appears only in SaaS mode.

Expected areas:

- Subscription overview with current plan, renewal/cancellation status, and next billing date.
- Pricing/change-plan entry point.
- Billing information.
- Invoice list with follow-up actions.
- Checkout return state when `payment_status` is present in the query string.

Design constraints:

- Keep billing action hierarchy clear: primary for upgrade/change plan, secondary for billing information or invoice actions.
- Use alerts for payment verification, success, cancellation, or failure states.
- Do not duplicate the layout subscription/license badge inside the tab; summarize details only.

## Global Users Tab

Global Users is a workspace-level end-user management view.

Toolbar:

- Search input: `Search by name`
- Display columns menu using a dropdown with checkboxes.
- Primary action: `Import`

Table:

- Use TanStack Table with server-side pagination.
- Columns:
  - `keyId`
  - `Name`
  - selected custom property columns
  - `Actions`
- Actions:
  - `Evaluate`
  - `Details`

Drawers and modals:

- Import should open an import modal using the global-users upload endpoint and sample JSON asset.
- Evaluate opens the user segments/flags evaluation drawer.
- Details opens the end-user detail drawer.

Empty and gated states:

- If Global Users is not licensed, show a gated feature state with a concise explanation and license/upgrade path.
- If search returns no users, show a table empty state that preserves the toolbar.

## Visual Direction

- Use the existing React layout language from `react-layout-design.md`.
- Prefer compact admin density over large editorial spacing.
- Use neutral cards, dividers, and tables; avoid large colored bands.
- Use lucide icons only where they help recognition: copy, save, key, shield/check, chart, users, upload.
- Keep radius at 6-8px.
- Text in controls must fit at mobile and desktop widths.
- Avoid one-note palettes; status accents should be sparse and semantic.
- Dark mode must not be a separate layout. It should match the light-mode information hierarchy and alignment exactly, using shadcn-style dark tokens: neutral dark page/sidebar surfaces, slightly lighter dark input/card surfaces, low-contrast borders, near-white primary text, muted gray secondary text, blue active/primary actions, and subdued green success/granted states.

## Implementation Notes For Later

- Generate code strictly according to the referenced design images. Treat meaningful differences in page structure, spacing, visual hierarchy, tab placement, form layout, button placement, borders, density, and light/dark theme styling as implementation defects unless this document and the design assets are updated first.
- Use shared typed API client with current workspace and organization headers.
- Use TanStack Query for workspace, license, usage, billing, and global-user data.
- Invalidate current workspace context after successful name/key or SSO updates.
- Keep all destructive or high-risk actions behind confirmation flows.
- Page must work in both `/en` and `/zh` routes.
- Add Playwright coverage for tab routing, permission-gated controls, license/SaaS conditional rendering, usage metric switching, and global-user table interactions.
