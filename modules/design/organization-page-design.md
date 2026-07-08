# Organization Page Design

This document defines the React design target for the Organization admin area. Angular remains the functional and information-architecture reference, but React should use the new authenticated layout, shadcn/ui primitives, Tailwind tokens, lucide-react icons, TanStack Query/Table, React Hook Form + Zod, and the shared typed API client. Do not copy the Angular/ng-zorro layout or visual styling.

## Scope And Boundaries

This design document covers only the Organization content area inside the authenticated layout.

- Implementing this page must not modify authenticated layout primitives such as the context bar, sidebar navigation, account menu, top-right subscription/license badge, layout spacing contract, or route-level layout frame.
- Organization belongs under Admin navigation, next to Workspace, IAM, Relay Proxies, and Integrations.
- The top application context bar remains `Organization / Project / Environment`. Organization page content may show organization identity and switching controls, but it must not change the global context bar contract.
- Profile management is an Angular functional reference, but React should treat user profile as an account-level surface. If `/organization/profile` is preserved for route compatibility, it should redirect to or reuse the account Profile surface rather than make Organization own personal account settings.
- If implementation requires a reusable layout primitive change, stop and update the layout design contract first instead of changing it as part of Organization page work.

## Design Assets

No static visual mock is required yet. When visual assets are added later, they should be stored beside this document and treated as page-content targets only, not as layout-shell targets.

Related design contracts:

- Authenticated layout: [react-layout-design.md](react-layout-design.md)
- Workspace admin precedent: [workspace-page-design.md](workspace-page-design.md)
- Global Users table and drawer precedent: [workspace-global-users-page-design.md](workspace-global-users-page-design.md)

## Angular Functional Reference

Angular exposes Organization as an Admin navigation entry with three tab-level areas:

- Organization: update organization name, copy organization ID, view organization key, update default feature-flag sorting, switch organization, create organization when multi-organization is licensed, and update default permissions for new organization members.
- Projects: filter projects, create/edit/delete projects, create/edit/delete environments, copy project/environment IDs, show current project/environment, and manage environment SDK secrets.
- Profile: update current user name/email and reset password for local users.

React should preserve the Organization and Projects behaviors, but should move Profile into the account/profile route family because the React authenticated layout already reserves the account menu for profile and personal preferences.

Permission and license behavior from Angular should be preserved:

- Updating organization name requires `UpdateOrgName`.
- Updating default flag sorting requires `UpdateOrgSortFlagsBy`.
- Updating default permissions requires `UpdateOrgDefaultUserPermissions`.
- Creating organizations requires both `CreateOrg` permission and the `multi-organization` license feature.
- Creating/updating/deleting projects, environments, and environment secrets must use the existing permission helpers for the relevant resource RN.
- Destructive actions such as deleting a project, deleting an environment, and deleting an environment secret remain behind confirmation flows.

## React Information Architecture

Route family:

```text
/:lang/organization
/:lang/organization/projects
/:lang/organization/profile
```

Recommended long-term ownership:

```text
/:lang/organization
/:lang/organization/projects
/:lang/account/profile
```

The Organization entry should open inside the authenticated layout under Admin. The page body should not introduce another left navigation. Use a compact page header plus horizontal tabs.

Page header:

- Title: `Organization`
- Subtitle: current organization name and key in muted inline form, for example `Acme Corp - acme`
- Primary header action: none by default. Keep create/switch/update actions inside the relevant sections.
- Do not show plan/license information in this header; that remains owned by the top-right subscription/license badge.

Tabs:

- `General`
- `Projects`

Compatibility tab:

- `Profile` should not be shown as a normal Organization tab in the new React IA. If the route is required for parity, handle it as a redirect or compatibility alias to the account Profile surface.

Use shadcn-style tabs with a bottom border. Keep tab density compact and avoid wrapping at normal desktop widths. On narrow widths, allow horizontal scrolling rather than stacking the tabs.

## General Tab

The General tab is an organization settings workbench. It should be calm and compact, with clear section dividers instead of nested card grids.

Content order:

1. Identity
2. Preferences
3. Switch organization

### Identity

Fields and actions:

- `ID`: read-only monospace copy row with a copy icon button and tooltip `Copy ID`.
- `Key`: read-only input-like field.
- `Name`: editable text field.
- `Save changes` action aligned with the form footer.

Behavior:

- Use React Hook Form + Zod validation.
- Name is required.
- Disable update if the user lacks `UpdateOrgName`; show a small permission note near the footer.
- On success, update the current organization store/localStorage and invalidate organization-dependent query data.
- Do not make key or ID look editable.

Layout:

- Use the same current `front-end-v2` shadcn form rhythm as Workspace General: labels above fields, `space-y-2`, `h-8` inputs, two equal columns with roughly `gap-5`.
- First row: `ID` in the left column and `Key` in the right column.
- Second row: `Name` in the left column only. Do not span it across the full page; leave the right column empty.
- Footer row: helper text on the left and a fixed-width `Save changes` button on the right.

### Preferences

Preferences is one visual section with two independent save groups. Do not split default permissions into a separate top-level section, but do keep sorting and default permissions as separate forms/mutations because they map to different backend APIs.

#### Sorting

Fields and actions:

- `Sort flags by`: select with `Created at` and `Key`.
- `Save sorting` action aligned with the group footer.

Behavior:

- Use the backend enum shape from Angular's `FlagSortedBy`.
- Disable update if the user lacks `UpdateOrgSortFlagsBy`.
- Keep helper copy minimal: `Default ordering for feature flag lists in this organization.`

#### Default Member Access

Purpose:

Default permissions determine what policy or group is assigned to users when they join the organization.

Fields:

- `Default policy`: searchable async select backed by the IAM policy list endpoint.
- `Default group`: searchable async select backed by the IAM group list endpoint.
- `Save permissions` action aligned with the group footer.

Behavior:

- Preserve Angular's rule that policy and group cannot both be empty after the form is touched.
- Use separate loading rows inside each select while remote options load.
- Show system-managed policies with a compact neutral badge or star icon, not a bright green Angular-style marker.
- Disable update if the user lacks `UpdateOrgDefaultUserPermissions`.
- On success, update the current organization store/localStorage and invalidate IAM/organization queries that depend on default permissions.

Layout:

- Use a two-column field row on wide desktop, collapsing to one column below the content's comfortable width.
- Place the validation message below the pair of selects, close to the section footer.
- Separate sorting and default member access with vertical whitespace only. Do not use dashed, dotted, or solid internal divider lines.
- Avoid putting policy and group selectors inside separate cards; they are one decision.

### Switch Organization

Purpose:

Switching organizations changes the active organization and clears current project/environment context. Creating an organization should be possible without leaving the settings flow, but it is gated by license and permission.

Controls:

- Searchable organization select with the current organization selected.
- `Create organization` button using a plus icon.

Behavior:

- Switching organization updates current organization localStorage, clears current project/environment, invalidates context-bound queries, and navigates to a safe default route such as `/organization` or the feature-flag list after a new project/environment is selected.
- If only one organization exists, keep the select visible but simple; do not hide the current context.
- If multi-organization is not licensed, disable `Create organization` and show a concise gated note: `Multi-organization is not enabled for this workspace.`
- If permission is missing, disable `Create organization` and show a permission note.

Layout:

- Use one field-width column for the `Organization` select, not a full-width select.
- Put helper text on the left and the fixed-width `Create organization` outline button on the right.

Create organization drawer:

- Use shadcn `Sheet` or the project's drawer wrapper, not a modal unless the drawer pattern is unavailable.
- Fields: `Name`, `Key`.
- Key auto-generates from name through the existing slugify behavior.
- Key validation is asynchronous and debounced; show duplicated and unknown validation states.
- The drawer opens from the right at roughly `420-480px` wide, with white background, left border, compact padding, and a top-right ghost close icon button.
- The drawer title is `Create organization`, with muted description `Create a new organization in this workspace.`
- The drawer footer has one primary action only: `Create organization`. Do not include a `Cancel` button; dismissal is handled by the close icon and sheet light-dismiss behavior.
- On success, close the drawer, add the organization to the organization list, switch to it, clear project/environment context, and show a success toast.

## Projects Tab

The Projects tab is an operational inventory of projects, environments, and SDK secrets. React should preserve Angular's hierarchy but redesign the presentation to be easier to scan.

Toolbar:

- Left: search input `Filter by name`.
- Right: primary `Create project` button.
- Search filters project names locally unless the backend later supports server-side filtering.
- Keep toolbar visible above loading, empty, and filtered-empty states.

Recommended layout:

- Use a project list with each project as a bordered section row, not a decorative card grid.
- The current project should appear first and show a compact `Current` badge.
- Each project row has a header with project name, key, current badge, and an action menu.
- Under each project header, show environments in a compact nested table/list with columns for Environment, Key, Description, Secrets, and Actions.
- Show current environment with a `Current` badge in the Environment cell.
- Keep copy-ID actions as icon buttons with tooltips inside row actions or action menus.

Project actions:

- Edit project.
- Delete project, hidden or disabled for the current project and guarded by confirmation.
- Add environment.
- Copy project ID.

Environment actions:

- Edit environment.
- Delete environment, hidden or disabled for the current environment and guarded by confirmation.
- Copy environment ID.

Secret actions:

- Add secret.
- Edit secret name.
- Delete secret, guarded by confirmation with the warning that the secret must be removed from SDKs first.
- Copy secret value.

Secret display:

- Show secret name, type badge (`server` or `client`), and masked/truncated value with copy action.
- Do not expose long secret strings as raw wrapping text in the environment row.
- If an environment has many secrets, collapse after a small count and offer `View all`.

Drawers and dialogs:

- Project create/edit: drawer with `Name`, `Key`, and any backend-supported project fields.
- Environment create/edit: drawer with `Name`, `Key`, `Description`, and environment settings supported by the Angular env drawer.
- Secret create/edit: small dialog is acceptable because the form is short; use a drawer only if future fields expand.

Pagination:

- Preserve Angular's "load more" behavior only if the API remains list-based. Prefer a compact list with incremental reveal over full table pagination while project counts are small.
- If organizations commonly have many projects, move to TanStack Table or virtualized grouped rows later.

## Account Profile Compatibility

Angular's Profile tab updates the current user's name/email and resets local-user passwords. React should treat this as account-level work:

- Account menu `Profile` opens the account Profile surface.
- `/organization/profile` may redirect to account Profile for backward-compatible bookmarks.
- The account Profile design should preserve Angular behavior: update name/email; reset password only for local-origin users; validate email, current password, new password, and confirm password.
- Do not duplicate profile forms inside Organization tabs.

## Visual Direction

Color strategy: Restrained. Organization is an admin settings surface, so neutral shadcn surfaces, borders, and semantic status accents should carry the hierarchy.

Theme scene sentence: A workspace administrator is managing organization defaults on a desktop monitor during release planning, with a light or system theme chosen by preference and enough operational density to avoid tab-hopping.

Reference anchors:

- Workspace page design in this repo for page header, tab density, section dividers, and form rhythm.
- Linear settings for compact setting rows and calm controls.
- Stripe dashboard for resource inventories with clear action hierarchy.

Layout rules:

- Use the existing React authenticated layout language from `react-layout-design.md`.
- Prefer compact section dividers over nested cards.
- Use cards only for repeated resource blocks where the boundary helps scanning, such as project sections.
- The General tab is page-body content only; it must not redesign or depend on sidebar/topbar visuals.
- Match the current `front-end-v2` shadcn component implementation:
  - Inputs/selects use `h-8`, `rounded-lg`, `border-input`, transparent/background surface, `px-2.5`, and desktop `text-sm`.
  - Default buttons use `h-8`, `rounded-lg`, `bg-primary`, `text-primary-foreground`, compact padding, and no blue primary styling.
  - Outline buttons use neutral borders and background; `Create organization` uses the outline variant.
  - Line tabs use the foreground underline from the current Tabs implementation, not a blue underline.
- General tab forms use a two-column grid with long one-column fields. A field may use one column or two explicitly, but `Name`, `Sort flags by`, and `Organization` should stay one-column width.
- The four General-tab action buttons, `Save changes`, `Save sorting`, `Save permissions`, and `Create organization`, must use the same fixed visual width and align to the same right edge.
- Use fixed product type scale, not fluid headings.
- Use lucide icons only where they improve recognition: copy, plus, search, shield, users, key, lock, more, trash, edit.
- Dark mode must match light-mode hierarchy and alignment exactly.

## Key States

General tab:

- Loading: skeleton rows matching Identity, Preferences sorting, Preferences default access, and Switch organization.
- Empty organization list: show a calm state that explains the user has no available organizations and should contact an administrator.
- Saving: disable only the relevant action and show inline loading on that action only. Sorting, default permissions, identity, and create-organization each have independent saving states.
- Success: toast `Operation succeeded`.
- Request error: toast `Operation failed, please try again`.
- Permission denied: disabled controls with short permission note; do not rely only on a toast after click.
- License gated: disabled `Create organization` with multi-organization gating note.
- Create organization drawer: open right-side Sheet with `Name` and `Key`; no `Cancel` button; close via top-right close icon or light-dismiss.

Projects tab:

- Loading: skeleton project sections with nested environment rows.
- No projects: toolbar remains visible; empty state prompts `Create project` if permission allows.
- Search no results: empty state says no projects match the filter and offers clear search.
- Project with no environments: show an inline empty row with `Add environment` when allowed.
- Environment with no secrets: show `No secrets` and an add action when allowed.
- Delete disabled for current project/environment: explain that current context cannot be removed.
- Copy success: toast `Copied`.

Account Profile:

- Local user: show profile form and reset-password form.
- Non-local user: show profile form only; omit reset-password section.
- Password mismatch and short password: inline field errors.

## Interaction Model

- Tabs change route and preserve browser navigation.
- Section updates are independent. Updating sort order should not mark organization name or default permissions as saving.
- Sorting and default permissions live in the same `Preferences` visual section but must submit through separate forms/mutations because they use different backend APIs.
- Search inputs should update results without requiring submit.
- Async selects should debounce remote search and show option-level loading.
- Destructive actions use shadcn confirmation dialogs or a shared `ConfirmAction` wrapper.
- Action menus should group low-frequency actions so project/environment rows stay scannable.
- Drawers close on successful create/edit and preserve typed values on validation errors.
- Switching organizations is a context-changing action; show immediate feedback and invalidate context-bound queries.

## Content Requirements

Primary labels:

- `Organization`
- `General`
- `Projects`
- `Identity`
- `ID`
- `Key`
- `Name`
- `Preferences`
- `Sort flags by`
- `Default policy`
- `Default group`
- `Switch organization`
- `Create organization`
- `Project`
- `Environment`
- `Secrets`

Operational helper copy:

- `Required when calling the FeatBit REST API.`
- `These settings identify your organization and are used across FeatBit.`
- `Default ordering for feature flag lists in this organization.`
- `Choose default organization behavior and access for new members.`
- `Assign a default policy or group to users when they join this organization.`
- `Switching organizations clears the current project and environment context.`
- `Multi-organization is not enabled for this workspace.`
- `This project cannot be removed while it is the current project.`
- `This environment cannot be removed while it is the current environment.`

Dynamic content ranges:

- Organizations: 0, 1, or many. Search is required when many exist.
- Projects: 0 to dozens. Current project should stay first.
- Environments per project: usually 1 to 5, but support more without row overflow.
- Secrets per environment: 0 to many. Long secret values must truncate and copy cleanly.
- Policy/group search: server-side search, up to the API page size used by Angular.

## Implementation Notes For Later

- Use shared typed API client with current workspace and organization headers.
- Use TanStack Query for organization list/current organization, policies, groups, projects, environments, and secrets.
- Keep organization state compatible with the existing localStorage key contract.
- Invalidate project/environment context queries after organization switching, project edits, environment edits, and secret changes.
- Split implementation by responsibility: page container, tabs/layout, API hooks, forms, project inventory, drawers/dialogs, permission helpers, and copy helpers.
- Split General tab mutations by backend contract: identity/name update, sorting preference update, default permissions update, and create organization.
- Use React Hook Form + Zod for forms and async validation where needed.
- Use shadcn `Button`, `Input`, `Select`/combobox composition, `Tabs`, `Sheet`, `Dialog`, `Table`, `Badge`, `Skeleton`, `Tooltip`, and `DropdownMenu`.
- Do not hand-edit generated `src/components/ui/*` files for this feature.
- Page must work in both `/en` and `/zh` routes.
- Add Playwright coverage for organization updates, sorting update, default permissions validation/update, organization switching, create organization drawer behavior without a Cancel button, create organization gating, project filtering, create/edit/delete project, create/edit/delete environment, secret add/edit/delete/copy, and `/organization/profile` compatibility behavior.
