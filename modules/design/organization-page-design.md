# Organization Page Design

This document defines the React design target for the Organization admin area. Angular remains the functional and information-architecture reference, but React should use the new authenticated layout, shadcn/ui primitives, Tailwind tokens, lucide-react icons, TanStack Query/Table, React Hook Form + Zod, and the shared typed API client. Do not copy the Angular/ng-zorro layout or visual styling.

## Scope And Boundaries

This design document covers only the Organization content area inside the authenticated layout.

- Implementing this page must not modify authenticated layout primitives such as the context bar, sidebar navigation, account menu, top-right subscription/license badge, layout spacing contract, or route-level layout frame.
- Projects tab design and mockups should show only the main page content area. Do not include the sidebar, context bar, or other authenticated shell chrome when documenting or implementing this tab.
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
- Account Profile surface: [profile-page-design.md](profile-page-design.md)

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

The Projects tab is an operational inventory of projects, environments, and SDK secrets. Angular's current page preserves the needed behavior, but its card spacing, action density, colored tags, and secret wrapping make the hierarchy hard to scan. React should redesign the page as a compact resource-management workbench while preserving every functional capability.

### Functional Scope

Preserve these Angular behaviors:

- List all accessible projects for the current organization and keep the current project first.
- Filter projects locally by project name.
- Incrementally reveal projects with a `Load more` action when the list is long.
- Create, edit, delete, and copy the ID for a project.
- Create, edit, delete, and copy the ID for an environment.
- Edit environment `Name`, `Key`, `Description`, and `Require change comment`.
- Create, edit, delete, copy, and view SDK secrets for each environment.
- Support `client` and `server` secret types; type can be selected during creation and is locked during edit.
- Keep project/environment keys generated from name during creation and validated asynchronously for uniqueness.
- Emit or replace the existing project-list/current-secret refresh behavior after project, environment, and secret changes.
- Update local current project/environment context when the current project name, current environment name, current environment settings, or current environment secrets change.
- Prevent deleting the current project or current environment.

### Page Structure

Toolbar:

- Left: search input `Filter by name`.
- Right: primary `Create project` button with `Plus`.
- Search filters project names locally unless the backend later supports server-side filtering.
- Keep toolbar visible above loading, empty, and filtered-empty states.
- Search input width should be around `320-420px`, not the Angular `520px` pill. Use the standard shadcn input height and a `Search` icon.
- Do not add environment or secret filters in the first migration. The first view should be understandable before it becomes a full inventory table.

Main inventory:

- Use a vertical list of project sections. Each section is a compact `rounded-md border bg-background` resource block matching the current `front-end-v2` table containers, with no ambient shadow and no nested cards.
- Project sections use a single compact header row and an environment `Table` below it. Do not use Angular's separate gray environment cards.
- The current project appears first and shows a compact neutral `Current` badge beside the project name.
- Project header must not consume much vertical space. Keep it to one line with tight padding, roughly `px-4 py-2` or equivalent.
- Project header left side: project name, `Key: {key}` badge, optional `Current` badge, and muted metadata such as `{environmentCount} environments`, all on one line with truncation.
- Project header right side: `Add environment` outline button and an icon-only `Edit project` button using the same edit icon treatment as secret edit-name actions. Replace the old three-dot project menu with this compact edit icon button.
- Keep `Add environment` visible because it is a common project-management action. Keep the project header action area short; do not add a full button strip.
- Under each project header, show environments in a compact table-like list with columns:
  - `Environment`: environment name, optional `Current` badge, and a secondary ID-copy icon in the same cell.
  - `Key`: monospace/truncated key.
  - `Description`: single-line truncated description with muted empty text when absent.
  - `Require change comment`: compact enabled/disabled badge for `settings.requireChangeComment`. The column header must include an info tooltip icon.
  - `Secrets`: a readable secret access area with visible copy controls, not a dense inline text dump.
  - `Actions`: `MoreHorizontal` menu.
- The `Require change comment` header tooltip should explain: `When enabled, users must provide a comment before saving flag or segment changes in this environment.`
- Use the current shadcn `Table` implementation style: `table-fixed`, `rounded-md border` wrapper, `TableHeader` with `bg-muted/40` or border-only treatment, `TableHead` compact padding, and `TableCell` `align-middle`.
- Prefer real `Table` over a CSS grid for the environment list so the page matches existing React table surfaces.
- Environment rows must vertically center all cell content, including badges, copy buttons, secret rows, and action menus. Use `align-middle`/`items-center` patterns rather than top-aligned multi-line blocks.
- Use compact row density. Keep environment rows as short as practical while preserving secret readability; prefer small text, `h-7`/`h-8` icon buttons, tight cell padding, and one-line truncated metadata.
- Project sections should have stable compact vertical spacing (`mt-4`, `gap-2` style rhythm) and must not resize when menus open.

Project actions:

- Header button: Add environment.
- Header icon button: Edit project.
- Delete project is disabled or hidden for the current project. Prefer disabled with helper text in the confirmation/action state when feasible: `This project cannot be removed while it is the current project.`
- Delete project requires confirmation: `This operation cannot be reverted. Remove this project?`

Environment actions:

- Menu items: Edit environment, Copy environment ID, Delete environment.
- Delete environment is disabled or hidden for the current environment. Prefer disabled with helper text when feasible: `This environment cannot be removed while it is the current environment.`
- Delete environment requires confirmation: `This operation cannot be reverted. Remove this environment?`

Secret actions:

- Add secret should be available from the `Secrets` cell with a compact `Plus` icon button or `Add secret` text button when the user has permission.
- The `Secrets` cell `Add secret` action must open the same create-secret dialog/sheet flow as the `View secrets` surface. It creates a secret for that row's environment.
- The create-secret flow opened from either place must let the user choose `Type` before submitting.
- Secret row actions in the main table: Copy secret value only.
- Secret row actions in the `View secrets` sheet: Copy secret value, Edit secret name, and Delete secret.
- Copy must be a first-class visible action. Each shown secret needs its own copy icon button next to the masked/truncated value, with tooltip `Copy secret`.
- The `Secrets` cell should also expose a `View secrets` action when an environment has any secret. This opens a focused sheet for viewing and copying the environment's secrets.
- Delete secret is guarded by confirmation with Angular's important warning preserved: `This operation cannot be reverted. Make sure this secret is removed from all SDKs before removing.`
- Copying a secret value uses an icon button and toast `Copied`; clicking the raw value should not be the only copy path.
- Secrets are editable only for their display name. Users can create secrets, rename existing secrets, and delete secrets, but cannot edit secret `Type` or `Value`.

Secret display:

- Show each secret on its own row. Each row contains secret name, type badge (`server` or `client`), masked/truncated value, and copy action.
- Do not expose long secret strings as raw wrapping text in the environment row.
- Use neutral badges for both `client` and `server`. Do not recreate Angular's cyan/geekblue tag colors.
- Use `font-mono text-xs` for secret values and truncate to a stable width.
- If a secret name or masked value does not fit, truncate with ellipsis and provide a tooltip with the full visible text. Copy still copies the full secret value.
- Show at most two compact secret rows in the environment row. If there are more, show `+N more` and a `View secrets` control. Opening it lists all secrets for that environment.
- The expanded secret view is a right-side `Sheet`, not an inline expansion. It should be optimized for scanning and copying: rows with `Name`, `Type`, masked `Value`, copy button, edit-name button, and delete button. Keep row height compact but give the value column enough width to distinguish secrets.
- The sheet must show both the corresponding project and environment. Use title/subtitle such as `Production secrets` plus `Growth Platform / Production`, or an equivalent compact header treatment.
- Values remain masked/truncated by default; copying copies the full value. Do not add an eye/reveal action in the first migration unless product/security requirements ask for explicit reveal.
- If an environment has no secrets, show muted `No secrets` plus the same `Add secret` action when the user can create one.

Drawers and dialogs:

- Project create/edit: right-side `Sheet`, `420-480px` wide, with `Name` and `Key`.
- Environment create/edit: right-side `Sheet`, `420-480px` wide, with `Name`, `Key`, `Description`, and a checkbox/toggle for `Require change comment`.
- Secret create/edit-name: compact `Dialog` is acceptable because the form is short. Creation fields are `Name` and `Type`; edit fields include `Name` only.
- `Type` selection uses the existing Angular enum values: `client` and `server`. Present them as `Client Side SDK` and `Server Side SDK`.
- During secret edit, show `Type` and masked `Value` as read-only context only if useful, but the only editable field must be `Name`.
- Creating a secret from the environment row or from the secrets sheet must use the same validation, permission check, mutation, and success handling.
- Drawer/dialog footers use one primary action: `Create project`, `Save project`, `Create environment`, `Save environment`, `Create secret`, or `Save secret`. Do not add a secondary Cancel button unless the shared dialog pattern requires it.
- Project and environment keys auto-generate from name on create, are disabled on edit, and use debounced async uniqueness validation with required, duplicated, and unknown states.
- Required validation messages stay inline and close to the field.

Pagination:

- Preserve Angular's "load more" behavior only if the API remains list-based. Prefer a compact list with incremental reveal over full table pagination while project counts are small.
- If organizations commonly have many projects, move to TanStack Table or virtualized grouped rows later.
- Initial reveal count may remain `3` for parity, but React should make the visible count a page constant rather than embedding the value in UI components.

### Permission And Context Rules

- `Create project` requires `CreateProject` on the general project RN.
- `Edit project` requires `UpdateProjectSettings` on the project RN.
- `Delete project` requires `DeleteProject` on the project RN.
- `Add environment` requires `CreateEnv` on the project RN.
- `Edit environment` requires `UpdateEnvSettings` on the environment RN.
- `Delete environment` requires `DeleteEnv` on the environment RN.
- `Create secret`, `Edit secret name`, and `Delete secret` require the corresponding environment-secret permissions on the environment RN. Do not expose editing for secret `Type` or `Value`.
- Disabled controls should show short permission or current-context notes in place. Do not rely only on a toast after click.
- After any project/environment mutation, invalidate the layout project list query and the organization projects query.
- After editing the current project, update the current project name in localStorage and the layout context.
- After editing the current environment, update current environment name and settings in localStorage and the layout context.
- After changing secrets for the current environment, update current environment secrets in localStorage and refresh any header/context secret popover data.

## Account Profile Compatibility

Angular's Profile tab updates the current user's name/email and resets local-user passwords. React should treat this as account-level work:

- Account menu `Profile` opens the account Profile surface.
- `/organization/profile` may redirect to account Profile for backward-compatible bookmarks.
- The account Profile design should preserve Angular behavior: update name/email; reset password only for local-origin users; validate email, current password, new password, and confirm password.
- Do not duplicate profile forms inside Organization tabs.
- Follow the dedicated Profile page contract in [profile-page-design.md](profile-page-design.md).

## Visual Direction

Color strategy: Restrained. Organization is an admin settings surface, so neutral shadcn surfaces, borders, and semantic status accents should carry the hierarchy.

Theme scene sentence: A workspace administrator is managing organization defaults on a desktop monitor during release planning, with a light or system theme chosen by preference and enough operational density to avoid tab-hopping.

Reference anchors:

- Workspace page design in this repo for page header, tab density, section dividers, and form rhythm.
- Linear settings for compact setting rows and calm controls.
- Stripe dashboard for resource inventories with clear action hierarchy.

Layout rules:

- Use the existing React authenticated layout language from `react-layout-design.md`.
- This page contract is for the main content area only. Visual design artifacts for Projects must exclude the global sidebar, top context bar, account menu, and subscription/license badge.
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
- Projects tab uses bordered resource blocks plus table-like nested rows. It must not use wide pill search inputs, large rounded Angular cards, green action links, or raw wrapping secret values.
- Projects tables should visually match existing React tables: `rounded-md border` wrapper, shadcn `Table`, muted or border-only header, compact `px-4 py-3` or tighter cells, and `align-middle` cells.
- Projects tab uses a compact density target: reduce row padding, avoid extra helper text inside rows, keep cell content vertically centered, and avoid multi-line wrapping except for the bounded secret row stack.
- Use the exact column label `Require change comment`; do not use the shorter `Change comments` label because it hides the boolean setting's meaning.
- Put a compact info icon beside the `Require change comment` column header and show its explanation in a tooltip. Do not put long helper text inside every row.
- Environment action menus use neutral destructive styling only for delete menu items; ordinary edit/copy/add actions remain neutral. Project edit is a direct button, not a menu item.
- Project edit uses an icon-only button with tooltip `Edit project`; do not render a text `Edit project` button in the project header.
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
- Permission denied: disable the relevant create/edit/delete/add-secret action and show a short note in the menu, row, drawer, or dialog state.
- Key validation pending: show validating state near the key field without blocking unrelated fields.
- Duplicated or unknown key validation: keep the drawer open and show inline error text.
- Secret list overflow: show the first two secrets and a `View secrets` or `+N more` control.
- Secret creation: opening `Add secret` from either the environment row or the secrets sheet shows the same required `Name` and `Type` fields.
- Load more: keep the button centered below the project list; loading more must not reset search.
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
- Project and environment key fields should debounce uniqueness validation at roughly the Angular cadence (`300ms`) unless the shared validation helper uses a different standard.
- Destructive actions use shadcn confirmation dialogs or a shared `ConfirmAction` wrapper.
- Action menus should group low-frequency actions so project/environment rows stay scannable.
- Drawers close on successful create/edit and preserve typed values on validation errors.
- Secret dialogs close on successful add/edit-name and preserve typed values on validation errors.
- Secret type is selectable during creation. Existing secrets allow `Name` editing only; `Type` and `Value` are read-only.
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
- `Projects`
- `Create project`
- `Edit project`
- `Add environment`
- `Environment`
- `Environments`
- `Description`
- `Require change comment`
- `Secrets`
- `Create secret`
- `Add secret`
- `Edit secret`
- `Edit secret name`
- `Type`
- `Client Side SDK`
- `Server Side SDK`
- `Load more`
- `View secrets`
- `Copy secret`

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
- `Keys are used in URLs and resource names. They can contain letters, numbers, dots, underscores, and hyphens.`
- `When enabled, users must provide a comment before saving flag or segment changes in this environment.`
- `Open all secrets for this environment.`
- `Copied`
- `This operation cannot be reverted. Remove this project?`
- `This operation cannot be reverted. Remove this environment?`
- `This operation cannot be reverted. Make sure this secret is removed from all SDKs before removing.`
- `No projects yet. Create a project to start adding environments.`
- `No projects match this filter.`
- `No environments yet. Add an environment to make this project usable.`
- `No secrets`

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
- Split Projects tab by responsibility: projects page container, toolbar/search, project section, compact environment table row, secret cell, secrets sheet, project sheet, environment sheet, secret dialog, confirm wrappers, and project context synchronization helpers.
- Use React Hook Form + Zod for forms and async validation where needed.
- Reuse Angular endpoint contracts for project, environment, and environment-secret APIs: `/api/v1/projects`, `/api/v1/projects/{projectId}/envs`, and `/api/v1/envs/{envId}/secrets`.
- Preserve the existing key uniqueness checks for project and environment creation.
- Preserve the existing localStorage current project/environment shape so the layout context bar, header secret access, and route guards continue to work, but do not include those shell elements in the Projects page implementation.
- Use shadcn `Button`, `Input`, `Select`/combobox composition, `Tabs`, `Sheet`, `Dialog`, `Table`, `Badge`, `Skeleton`, `Tooltip`, and `DropdownMenu`.
- Do not hand-edit generated `src/components/ui/*` files for this feature.
- Page must work in both `/en` and `/zh` routes.
- Add Playwright coverage for organization updates, sorting update, default permissions validation/update, organization switching, create organization drawer behavior without a Cancel button, create organization gating, project filtering, create/edit/delete project, create/edit/delete environment, secret add/edit/delete/copy, and `/organization/profile` compatibility behavior.
