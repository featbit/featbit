# IAM Group Detail Page Design

This document is the React design contract for the IAM Group detail page. Angular remains a functional reference for Group relationships and API behavior, but the React page must use the current IAM Team detail page as its structural and visual template.

Related list contract: [iam-group-page-design.md](iam-group-page-design.md).

## Required Design

- Group detail, Team tab, light theme: [iam-group-detail-page-light.png](iam-group-detail-page-light.png)

The saved image is the required baseline for hierarchy, density, spacing, tabs, two-line identity cells, semantic color usage, and pagination placement. Text values and row data are illustrative; the structure and interaction model are normative.

## Route And Page Scope

- The detail route is `/:lang/iam/groups/:groupId/:tab`.
- Supported tabs are `team` and `policies`.
- Opening a Group from the list defaults to the `team` tab.
- Keep the authenticated sidebar and Organization / Project / Environment context bar unchanged.
- IAM stays expanded and Groups remains the active navigation item.
- This contract covers the main content region only and is desktop-first.

## Compact Group Header

Use the current React Team detail header without a summary card.

1. A back link labeled `Groups` returns to the Group list.
2. The group name is the `24px` semibold page title.
3. Show the group description directly below the title. Use a quiet fallback when no description exists.
4. Show the Resource name in the current segmented RN control:
   - compact `RN` label segment;
   - monospaced value such as `group/engineering`;
   - copy icon segment.
5. Place the outline destructive `Remove group` action at the far right.

Match the current Team detail spacing: approximately `20px` from back link to title, `4px` from title to description, `12px` from description to RN, and a compact header height around `112px`.

Do not add a settings side panel, identity card, member/policy metrics, avatars, role badges, or organization metadata.

## Tabs

Use a full-width URL-backed line tab row immediately below the header:

- `Team` with the current direct member count;
- `Policies` with the current directly assigned policy count.

Counts use compact neutral badges. The active tab uses stronger text and a thin foreground underline. Do not use pill tabs, filled tab containers, or saturated active colors.

## Team Tab

The Team tab shows only members currently contained by the group.

### Toolbar

- Left: `Filter by email` search input, approximately `320px` wide.
- Right: primary action `Add member` with a leading plus icon.
- Available members belong in the add flow; do not add an `All` / `Contained by current group` selector to the table toolbar.

### Table

| Column | Content |
| --- | --- |
| Name | Two-line identity block: member name on the first line; copy icon and member Resource name on the second line. |
| Email | Member email. |
| Actions | `Details` and destructive `Remove`. |

### Two-Line Resource Name Rule

Every member Name cell must show Resource name on its second line.

1. First line: member name as semibold link text; fall back to email when the name is absent.
2. Second line: compact ghost copy icon and monospaced member Resource name, for example `member/ava.chen@acme.io`.

Do not add a separate Resource name column. Long names, emails, and Resource names truncate safely and expose the full value using the established tooltip pattern.

`Details` opens the Team member detail page. `Remove` removes the direct group membership only; it must not remove the member from the organization or workspace.

## Add Member Sheet

Clicking `Add member` opens a right-side shadcn `Sheet` based on the Team detail relationship picker.

The Sheet contains:

1. Title `Add members to <group name>`.
2. Search input for email or name.
3. Members not currently contained by the group.
4. Multi-selection with selected values shown as removable compact chips.
5. Sticky footer with one right-aligned primary action labeled `Add`.

Do not show already-contained members as addable rows. On success, close the Sheet, refresh the Team table and tab count, and show a translated success toast.

## Policies Tab

The Policies tab shows only policies directly assigned to the group.

### Toolbar

- Left: `Filter by policy name`.
- Right: primary action `Add policy`.
- Do not add an `All` / `Affected to current group` selector.

### Table

| Column | Content |
| --- | --- |
| Name | Two-line identity block: policy name, then copy icon and `policy/<key>` Resource name. |
| Type | System-managed or customer-managed label; system policies use the shared star icon. |
| Description | Policy description with safe truncation. |
| Actions | `Details` and destructive `Remove`. |

`Add policy` uses the same right-side searchable multi-select Sheet model as `Add member`, excluding policies already assigned to the group.

## Table And Pagination Geometry

- Use the same bordered TanStack Table structure as the current Team detail page.
- The table is the only bordered container in the relationship area.
- Header and body cells use approximately `20px` horizontal and `16px` vertical padding.
- Use thin row separators, neutral hover state, restrained radius, and no ambient shadow.
- Keep pagination outside the bordered table.
- Pagination uses a standalone row with approximately `16px` vertical padding: summary on the left, page controls and page-size selector on the right.
- Never place a large outer border around the table and pagination together.
- Default relationship page size is `20`, with options `10`, `20`, and `30` when supported by the shared pagination component.

## Destructive Actions

### Remove Member Or Policy Relationship

Use a confirmation dialog that names the member or policy and states that only its direct relationship with the current group will be removed. Disable the confirm action while saving. On success, refresh the current table and count.

### Remove Group

The header action opens a destructive confirmation dialog naming the group and stating that deletion cannot be reverted. On success, return to the Group list and show a translated toast.

Do not use inline Angular popconfirms.

## States

- **Loading:** retain the header and tab structure and use compact skeletons for identity and table rows.
- **Group load error:** show a translated inline error with Retry near the header.
- **Tab load error:** keep header and tabs available, then show an inline error with Retry in the relationship area.
- **Empty Team:** state that the group has no members and offer `Add member`.
- **Empty Policies:** state that the group has no directly assigned policies and offer `Add policy`.
- **No search results:** state that nothing matches the current query and provide `Clear search`.
- **Mutation success or failure:** use translated Sonner toasts while preserving current page context.

## Semantic Style Contract

- Use `background`, `foreground`, `muted-foreground`, `border`, `accent`, `primary`, and `destructive` tokens.
- Keep the page flat and structurally identical in light and dark themes.
- Use current shared shadcn/Base UI components and do not modify generated component files.
- Body and table text use the established compact `14px` scale; controls stay around `32px` high.
- Use destructive red only for destructive actions, confirmation, and error state.
- Do not recreate the Angular split settings panel or ng-zorro visual language.

## Internationalization And Accessibility

- All user-visible copy belongs in the IAM translation resource.
- English and Chinese routes preserve the same hierarchy and URL-backed tabs.
- Long group names, descriptions, member names, emails, policy names, and Resource names truncate safely and expose their full value through tooltips where needed.
- Preserve shadcn/Base UI keyboard behavior and focus rings.
- Provide accessible names for copy and other icon-only actions.
- Relationship and destructive state must not rely on color alone.

## Acceptance Criteria

- The Group detail page follows the current React Team detail header, tabs, toolbar, table, and pagination structure.
- The header shows group name, description, segmented Resource name control, and `Remove group` without a summary card.
- Team and Policies are URL-backed line tabs with neutral count badges.
- Team rows contain direct members only.
- Member Resource name appears on the second line of the Name cell and never in a separate column.
- Policy Resource name follows the same second-line Name-cell pattern.
- Add member and Add policy use searchable relationship-picker Sheets containing available items only.
- Removing a member removes only the current group relationship.
- Pagination stays outside the table border with no large enclosing border.
- Loading, error, empty, and search-empty states provide clear recovery actions.
- Light and dark themes use semantic tokens, and English/Chinese routes remain translated.
