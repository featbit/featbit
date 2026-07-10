# IAM Team Page Design

This document defines the React design target for the IAM `Team` migration. Angular remains the functional reference only. React should preserve the member, group, direct-policy, inherited-policy, and removal behaviors while using the existing authenticated layout, shadcn/ui primitives, Tailwind tokens, lucide-react icons, TanStack Query, TanStack Table, React Hook Form + Zod, and `react-i18next`.

Do not copy Angular/ng-zorro styling, spacing, or green action-link treatment. The Team experience should feel like a natural sibling of the current React Organization and Workspace admin pages: compact, neutral, table-first, and easy to scan.

## Design Assets

- Team list light concept: [iam-team-list-light.png](iam-team-list-light.png)
- Team detail light concept: [iam-team-detail-light.png](iam-team-detail-light.png)
- Add member drawer light concept: [iam-team-add-member-light.png](iam-team-add-member-light.png)

The visual assets are page-content targets. They must not be interpreted as changes to the global sidebar, top context bar, account menu, or subscription/license badge.

## Scope And Boundaries

This design covers only the IAM `Team` area inside the authenticated layout.

- Do not modify authenticated layout primitives, sidebar grouping, context bar, account menu, or top-right license badge.
- Do not introduce a second IAM sidebar inside the page body.
- Do not add IAM top-level tabs such as `Team`, `Groups`, and `Policies` inside the Team list page. This first migration step covers only Team and Team detail; Groups and Policies pages are out of scope.
- Preserve `/iam/users` route compatibility if the backend or Angular routes use `users`; the React UI label should be `Team`.
- The first migration step covers Team only. Groups and Policies detail redesigns should be documented separately unless a Team interaction links to them.

## Angular Functional Reference

Angular currently provides these Team behaviors:

- List members with server-side pagination.
- Search members by email through `searchText`.
- Add a member through a drawer.
- Add-member form requires `email` plus at least one permission source: direct policy or group.
- Search policies and groups server-side inside the add-member drawer.
- Show member `Name`, `Email`, `Resource name (RN)`, first three groups, initial password, and row actions.
- Copy member RN.
- Copy initial password when present; show masked value when absent.
- Open member detail.
- Remove a member from the current organization when the row is not the current user.
- Remove a member from the workspace and all related organizations when the row is not the current user.
- Member detail shows identity summary: name, email, RN.
- Member detail supports removing the member from the current organization when the member is not the current user.
- Detail tab `Groups` searches by group name, toggles between all groups and groups containing the current member, paginates, opens group details in a new tab, adds the member to a group, and removes the member from a group.
- Detail tab `Direct policies` searches by policy name, toggles between all policies and policies assigned to the current member, paginates, opens policy details in a new tab, adds a direct policy, and removes a direct policy.
- Detail tab `Inherited policies from groups` searches by policy name, paginates, shows the source group name, and opens policy details in a new tab.

Preserve these data and interaction behaviors in React.

## React Information Architecture

Route family:

```text
/:lang/iam/team
/:lang/iam/team/:memberId
/:lang/iam/team/:memberId/groups
/:lang/iam/team/:memberId/direct-policies
/:lang/iam/team/:memberId/inherited-policies
```

Compatibility route aliases may preserve Angular paths:

```text
/:lang/iam/users
/:lang/iam/users/:memberId/groups
/:lang/iam/users/:memberId/direct-policies
/:lang/iam/users/:memberId/inherited-policies
```

Page header:

- Title: `Team`
- Subtitle: concise IAM context such as `Manage organization members and their effective access.`
- Primary header action on list page: `Add member`.
- Detail page header action: none by default; destructive removal belongs in the identity section.

Within member detail:

- `Groups`
- `Direct policies`
- `Inherited policies`

Use compact shadcn-style tabs with a bottom border only for the member detail tabs. Keep tab labels readable; do not shorten `Inherited policies` so much that the source becomes unclear.

## Team List Page

The list is the primary operational surface. It should be table-first, with toolbar controls above a single bordered table.

The Team list page must not render a `Team / Groups / Policies` tab row. The authenticated sidebar already provides the broader Admin navigation; the list page content starts with the Team header, then the toolbar and table.

### Toolbar

Left:

- Search input with Search icon.
- Placeholder: `Filter by email`.
- Debounce at roughly Angular cadence, `300ms`.
- Search resets pagination to page 1.

Right:

- Primary `Add member` button with Plus icon.

Do not add summary cards above the table in the first migration. Counts are better expressed in pagination and table state.

### Table

Use TanStack Table with server-side pagination.

Columns:

- `Member`
- `Email`
- `Resource name`
- `Groups`
- `Initial password`
- `Actions`

Cell behavior:

- `Member`: primary name. If missing, show muted `No name`. The cell links to member detail.
- `Email`: plain text, truncates when long.
- `Resource name`: monospace `member/{email}`, with a visible Copy icon button and tooltip `Copy RN`.
- `Groups`: show up to three neutral outline badges. If more than three, show a compact `+N more` badge. Group names should truncate with tooltip if needed.
- `Initial password`: if present, show monospace value with Copy icon button. If absent, show muted masked value `******`.
- `Actions`: `Details` link plus a `MoreHorizontal` menu for destructive removal actions.

Action behavior:

- `Details` opens the member detail route in the same tab.
- `Remove from organization` requires confirmation: `This operation will remove the user from the current organization.`
- `Remove from workspace` requires confirmation: `This operation will remove the user from the workspace and all related organizations.`
- The current user cannot remove themselves. Hide destructive actions or show disabled menu items with `You cannot remove yourself.`

Pagination:

- UI page index is one-based.
- API page index remains zero-based.
- Page size options: `10`, `20`, `30`.
- Show total count text, for example `Showing 1 to 10 of 42 members`.

### List States

Loading:

- Keep toolbar visible.
- Render skeleton rows matching the visible columns.

Empty:

- No members: `No team members yet` with `Add member` action when permitted.
- Active search: `No members match this email` with `Clear search`.

Error:

- Inline alert above table body: `Failed to load team members`.
- Include `Retry`.

Permission disabled:

- If adding members is not permitted, disable `Add member` and show a tooltip explaining the missing permission.
- If removal is not permitted, hide or disable the relevant destructive menu item with a short note.

## Add Member Drawer

Trigger: `Add member`.

Surface:

- Right-side `Sheet`, desktop width `460px` to `500px`.
- Header title: `Add team member`.
- Description: `Invite or attach a user to this organization with an initial group or policy.`
- Footer primary action: `Add member`.
- Do not include a secondary Cancel button unless a shared sheet pattern requires it. Dismiss via close icon or light-dismiss.

Fields:

- `Email`: required, accepts the same email/phone-email validation behavior as Angular.
- `Policy`: searchable async select, optional.
- `Group`: searchable async select, optional.

Validation:

- Email is required and must be valid.
- At least one of `Policy` or `Group` is required.
- Show validation close to the permission selectors: `Select at least one policy or group.`

Async selects:

- Use server-side search.
- Show loading rows inside the option list.
- System-managed policies show a compact neutral `System` badge or Star icon, not a bright green Angular marker.
- Keep selected values visible even if subsequent search results do not include them.

Success and errors:

- On success, close the drawer, refresh the Team list, and show toast `Operation succeeded`.
- On failure, keep the drawer open and show toast `Operation failed`.

## Member Detail Page

The detail page should make the access model obvious: identity on top, then the three sources of access below.

### Identity Summary

Use a single bordered section above the member tabs.

Layout:

- Left block: member name as section title, email below it, optional muted `Current user` badge when viewing self.
- Metadata rows: `Resource name`, with copy action; `Member ID` if useful for debugging or API support.
- Right block: a compact access summary when counts are available: direct policies, groups, inherited policies. If counts require extra endpoints, omit summary counts for the first migration rather than adding slow calls.
- Destructive action: `Remove from organization` as an outline/destructive-leaning button or menu item, only when the member is not the current user and permission allows it.

Do not make the identity summary a large profile card with avatar decoration. IAM is a permission workbench, not a social directory.

### Detail Tabs

The same table vocabulary should be used across all three tabs: toolbar, bordered table, pagination, loading/empty/error states.

#### Groups Tab

Toolbar:

- Search input: `Filter by group name`.
- Segmented control or select:
  - `Current member`
  - `All groups`

Table columns:

- `Group`
- `Description`
- `Membership`
- `Actions`

Cell and action behavior:

- `Group` links to the group detail page in a new browser tab.
- `Membership` shows `Member` or `Not a member`.
- Actions:
  - `Details` opens group detail in a new tab.
  - `Add` when not a member.
  - `Remove` when already a member, with confirmation naming the group.

#### Direct Policies Tab

Toolbar:

- Search input: `Filter by policy name`.
- Segmented control or select:
  - `Assigned`
  - `All policies`

Table columns:

- `Policy`
- `Type`
- `Description`
- `Assignment`
- `Actions`

Cell and action behavior:

- `Policy` links to policy permission detail in a new browser tab.
- `Type` uses text plus a compact neutral `System` marker for `SysManaged`.
- `Assignment` shows `Assigned directly` or `Not assigned`.
- Actions:
  - `Details` opens policy detail in a new tab.
  - `Add` when not directly assigned.
  - `Remove` when directly assigned, with confirmation.

#### Inherited Policies Tab

Toolbar:

- Search input: `Filter by policy name`.

Table columns:

- `Policy`
- `Inherited from`
- `Type`
- `Description`
- `Actions`

Cell and action behavior:

- `Inherited from` shows the source group name.
- No add/remove actions appear here because inherited policies are managed through groups.
- `Details` opens policy permission detail in a new browser tab.

### Detail States

Loading:

- Identity summary skeleton plus table skeleton for the active tab.

Empty:

- Groups/current member: `This member is not in any groups.`
- Groups/all search: `No groups match this filter.`
- Direct policies/assigned: `No direct policies assigned.`
- Direct policies/all search: `No policies match this filter.`
- Inherited policies: `No policies inherited from groups.`

Error:

- Identity load failure: page-level inline error with `Back to Team`.
- Tab load failure: inline table alert with `Retry`.

## API And Data Notes

List endpoint:

```text
GET /api/v1/members
params:
  searchText: string
  pageIndex: number
  pageSize: number
```

Member endpoint:

```text
GET /api/v1/members/{id}
```

Add member:

```text
POST /api/v1/members/add
body:
  email: string
  policyIds: string[]
  groupIds: string[]
```

Remove member:

```text
DELETE /api/v1/members/remove-from-org/{id}
DELETE /api/v1/members/remove-from-workspace/{id}
```

Member groups:

```text
GET /api/v1/members/{id}/groups
params:
  name: string
  getAllGroups: boolean
  pageIndex: number
  pageSize: number
```

Direct policies:

```text
GET /api/v1/members/{id}/direct-policies
params:
  name: string
  getAllPolicies: boolean
  pageIndex: number
  pageSize: number

PUT /api/v1/members/{id}/add-policy/{policyId}
PUT /api/v1/members/{id}/remove-policy/{policyId}
```

Inherited policies:

```text
GET /api/v1/members/{id}/inherited-policies
params:
  name: string
  pageIndex: number
  pageSize: number
```

Group membership changes reuse the group API:

```text
PUT /api/v1/groups/{groupId}/add-member/{memberId}
PUT /api/v1/groups/{groupId}/remove-member/{memberId}
```

## Visual Direction

Color strategy: Restrained. IAM is sensitive and operational, so neutral surfaces, borders, semantic destructive states, and a small number of badges should carry the hierarchy.

Theme scene sentence: An organization administrator is reviewing member access during a release-readiness check on a desktop monitor; the page needs to answer "who has access, from where, and how do I change it?" without visual drama.

Layout rules:

- Match the current React authenticated product style: white or dark neutral page surface, compact typography, shadcn controls, thin borders, no ambient card shadows.
- Page headers in this Team surface should not add a horizontal divider under the title/subtitle. Let whitespace separate the header from the toolbar or identity summary.
- Use `h-8` inputs/buttons, `rounded-lg` controls, `rounded-md` table containers, compact `px-4 py-3` table cells, and neutral action menus.
- Use cards only for the identity summary and table/resource boundaries. Do not nest cards inside cards.
- Sheet footers should not add a horizontal divider above the footer action. Use spacing and the fixed footer position for separation.
- Use lucide icons only where recognition improves: Search, Plus, Copy, MoreHorizontal, ExternalLink, UserPlus, ShieldCheck, Users, KeyRound, Trash.
- Use neutral outline badges for groups and system policy markers. Avoid Angular-style bright green icons as the primary visual signal.
- Destructive actions should be text-destructive in menus or confirmation dialogs, not always visible red buttons in every row.
- Dark mode must preserve the same layout, density, and hierarchy.

## Content Requirements

Primary labels:

- `Team`
- `Add member`
- `Filter by email`
- `Member`
- `Email`
- `Resource name`
- `Groups`
- `Initial password`
- `Details`
- `Remove from organization`
- `Remove from workspace`
- `Current user`
- `Direct policies`
- `Inherited policies`
- `Filter by group name`
- `Filter by policy name`
- `Current member`
- `All groups`
- `Assigned`
- `All policies`
- `Policy`
- `Type`
- `Description`
- `Membership`
- `Assignment`
- `Inherited from`
- `Copy RN`
- `Copy password`

Operational helper copy:

- `Manage organization members and their effective access.`
- `Invite or attach a user to this organization with an initial group or policy.`
- `Select at least one policy or group.`
- `This operation will remove the user from the current organization.`
- `This operation will remove the user from the workspace and all related organizations.`
- `You cannot remove yourself.`
- `No team members yet.`
- `No members match this email.`
- `This member is not in any groups.`
- `No direct policies assigned.`
- `No policies inherited from groups.`
- `Copied`
- `Operation succeeded`
- `Operation failed`

## Acceptance Criteria For Later Implementation

- Team list renders inside the existing authenticated layout without altering shell chrome.
- List search debounces, resets page index to 1, and queries `searchText`.
- List pagination is server-side with page sizes `10`, `20`, and `30`.
- Add member drawer validates email and requires at least one policy or group.
- Policy and group selectors in the drawer support remote search and loading states.
- Member RN and initial password can be copied.
- Current user cannot remove themselves from organization or workspace.
- Remove-from-organization and remove-from-workspace use confirmation flows.
- Member detail shows identity summary and the three access tabs.
- Groups tab can switch between current membership and all groups, add/remove membership, and open group detail in a new tab.
- Direct Policies tab can switch between assigned and all policies, add/remove direct policies, and open policy detail in a new tab.
- Inherited Policies tab shows source group names and opens policy detail in a new tab.
- Loading, empty, error, no-permission, and destructive-confirmation states are designed.
- Visible text uses i18n keys and works in `/en` and `/zh` routes.
- Implementation does not hand-edit generated `src/components/ui/*` files.
- Add Playwright coverage for list search/pagination, add-member validation, copy actions, remove protections for current user, group membership changes, direct-policy changes, inherited policy display, and route compatibility aliases.
