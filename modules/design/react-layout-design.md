# FeatBit React Layout Design

This document is the implementation design contract for the authenticated React layout. The current saved design governs the header/context bar, sidebar, sidebar collapse behavior, account menu, subscription/license badge, density, typography scale, and light/dark layout language. The Feature Flags content shown in the images is only a placeholder/example and still needs a separate product-page design pass before it becomes an implementation target. Pixel-perfect reproduction is not required, but meaningful layout deviations should update this document and the saved design assets first.

## Design Assets

- Light theme concept: [react-layout-light.png](react-layout-light.png)
- Dark theme concept: [react-layout-dark.png](react-layout-dark.png)

## Overall Direction

- Build a modern FeatBit layout with shadcn/ui, Radix primitives, Tailwind CSS, and lucide-react.
- Use shadcn/ui components as the default implementation source for standard controls and surfaces. Only create custom UI when shadcn does not provide the needed component or when FeatBit-specific behavior cannot be represented by composing shadcn components.
- Do not copy Angular/ng-zorro styling or the old Angular color palette.
- Prefer shadcn default neutral tokens, semantic colors, subtle borders, restrained shadows, compact density, and 6-8px radius controls.
- Support light and dark mode as first-class themes using shadcn native dark-mode patterns.
- Use the current FeatBit logo style: mark + wordmark when the sidebar is expanded, mark only when collapsed.

## Component Usage

- Prefer shadcn components for buttons, inputs, selects, checkboxes, switches, tabs, dropdown menus, command palettes, popovers, tooltips, dialogs, sheets/drawers, cards, badges, alerts, tables, forms, calendars, and chart wrappers.
- Compose local product components from shadcn primitives before introducing custom markup or styling.
- Custom components must keep shadcn/Tailwind tokens, semantic variants, focus rings, spacing, radius, and light/dark CSS variables.
- Use Radix primitives directly only when shadcn does not expose the exact primitive needed.

## Layout

- Left sidebar: product navigation, FeatBit brand, collapse control, and left-bottom account entry.
- Top context bar: only shows `Organization / Project / Environment`.
- Main content: shown only as a placeholder/example in the saved images; page-specific content still needs separate design.
- Top-right header: only shows the subscription/license badge.
- Do not place user avatar, theme switcher, or language switcher in the top-right header.

## Context Bar

The context path must show only:

```text
Acme Corp / Growth Platform / Production
```

- Do not include a `FeatBit` root crumb.
- Do not include plan/license information in the context path.
- `Production` is the primary environment switch entry.
- Clicking the environment opens a shadcn `Popover` + `Command` search over all projects and environments in the current organization.
- Group environment results by project.
- Selecting an environment from another project updates both current project and current environment.

## Sidebar

- Expanded sidebar shows FeatBit mark + wordmark.
- Expanded sidebar includes a subtle `PanelLeftClose` icon button near the sidebar/content divider.
- Collapsed sidebar becomes an icon rail.
- Collapsed sidebar shows only the FeatBit mark, hides section labels and item text, and uses tooltips.
- Collapsed sidebar uses `PanelLeftOpen` to restore the expanded state.
- Persist collapse state in localStorage, for example `featbit:sidebar-collapsed`.

Navigation groups:

- Get Started
- Release: Feature Flags, Segments, End Users
- Experimentation: Experiments, Metrics
- Governance: Audit Logs, Change Requests
- Admin: Workspace, Organization, IAM, Relay Proxies, Integrations
- IAM sub-items: Team, Groups, Policies
- Integrations sub-items: Webhooks, Access Tokens

## Account Menu

- The left-bottom Account entry is the single authenticated identity/preference/version entry.
- FeatBit does not support configurable user avatars, so use initials or a generic user icon.
- Expanded account entry shows name and email.
- Collapsed account entry shows initials or a generic user icon with tooltip.
- Account menu contains:
  - Profile
  - Support
  - Documentation
  - Language
  - Theme
  - Version
  - Sign out
- Do not duplicate plan/subscription information in the Account menu.

## Subscription And License Badge

The top-right badge follows the Angular implementation's information model, but uses shadcn styling.

States:

- SaaS Free plan: `Free Plan` / `Upgrade Now`
- Expired license: `License Expired` / `<plan name>`
- Expiring license: `Expiring in N days` / `<plan name>`
- Active paid license: `Current Plan` / `<plan name>`
- Missing license/plan data: `Upgrade Now` / `Get Enterprise`

Behavior:

- Clicking the badge navigates to Workspace billing/subscription settings.
- Free plan should open the pricing/upgrade flow.
- Paid/license states should open license or subscription detail.
- Detailed billing/subscription/license information belongs in Workspace.

Visual constraints:

- Keep the badge compact and two-line.
- Vertically center it in the header.
- Keep enough space between its border and the header bottom divider.
- Do not make the badge so tall that it increases the visual height of the context bar.

## Feature Flags Placeholder

The Feature Flags area in the saved images is not yet the final Feature Flags page design. It exists to provide a realistic content frame while evaluating the layout.

- Do not treat the Feature Flags table, toolbar, row density, filters, or list content in these images as final implementation requirements.
- The actual Feature Flags list/detail/targeting views need a separate design pass.
- Until that pass is complete, use the saved images only for layout alignment around the content area.

## Theme Notes

- Light mode uses white and near-white surfaces with neutral text and subtle gray borders.
- Dark mode uses neutral dark surfaces, not pure black.
- Avoid large areas of FeatBit green.
- Brand color may appear in logo and rare accents only.
- Use the same layout and information hierarchy in both themes.

## Future Modification Guidelines

- Preserve the current compact SaaS layout density.
- Avoid adding extra top-right controls beyond the subscription/license badge.
- Keep environment switching in the context bar, not the sidebar.
- Keep account/preferences/version in the left-bottom Account menu.
- Keep billing/subscription detail under Workspace.
- When changing the header, check that the subscription/license badge remains vertically centered.
- Do not treat the placeholder Feature Flags content as final page design.
