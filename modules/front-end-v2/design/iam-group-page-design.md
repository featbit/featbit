# IAM Group Page Design

This document is the React design contract for the IAM Group list page. Angular remains a functional reference for Group data and API behavior, but the React implementation must follow the current IAM Team list page structure and its shadcn/ui, Base UI, Tailwind, TanStack Table, and authenticated-shell conventions.

The Group detail page has a separate contract in [iam-group-detail-page-design.md](iam-group-detail-page-design.md).

## Required Design

- Group list, light theme: [iam-group-list-light.png](iam-group-list-light.png)

The saved image is the required baseline for hierarchy, density, spacing, table structure, and semantic color usage. Row data is illustrative. Any intentional structural change must update this document and the saved design first.

## Route And Page Scope

- The list route is `/:lang/iam/groups`.
- Keep the authenticated sidebar and Organization / Project / Environment context bar unchanged.
- IAM stays expanded and Groups is the active navigation item.
- This contract covers the main content region only.
- Design for professional desktop workflows first; do not introduce a separate mobile composition unless requested.

## Page Header

Use the same header rhythm as the current React Team list page:

- title: `Groups`;
- subtitle: `Manage groups and organize member access.`;
- main content padding: approximately `32px` horizontally and `24px` vertically;
- title size: `24px`, semibold;
- subtitle size: `14px`, muted;
- header-to-toolbar spacing: approximately `40px`.

Do not add tabs, metrics, summary cards, IAM explanations, or decorative content above the list.

## Toolbar

- Left: a `320px` search input with the placeholder `Filter by name`.
- Right: the default primary action `Add group` with a leading plus icon.
- Inputs and buttons use the current Team page's compact `32px` control height.
- Keep approximately `20px` between the toolbar and table.

`Add group` opens a right-side shadcn `Sheet`. The sheet contains a required Name field, optional Description field, and a right-aligned Save action. Name uniqueness validation must preserve the existing backend behavior. The sheet must not alter the underlying list layout.

## Table

Use a bordered TanStack Table with server-side search and pagination.

| Column | Content |
| --- | --- |
| Name | Two-line identity block: group name on the first line; copy icon and Resource name on the second line. |
| Description | Group description; show `-` when empty. |
| Actions | `Details` and destructive `Remove`. |

### Two-Line Resource Name Rule

Resource name must never occupy a separate table column.

Each Name cell uses the same two-line pattern established by the current React Team and Team-detail tables:

1. First line: group name as semibold link text. It opens `/:lang/iam/groups/:groupId/team`.
2. Second line: a compact ghost copy icon followed by the monospaced Resource name, for example `group/engineering`.

The second line uses compact muted text and a small vertical gap from the name. Long group names and Resource names truncate safely and expose the full value through the established tooltip pattern.

### Table Geometry

- The table is the only bordered container in the list area.
- Use one subtle border, a restrained `6px`-like radius, and no ambient shadow.
- Header and body cells use approximately `20px` horizontal and `16px` vertical padding.
- Rows use thin dividers and the current neutral hover state.
- `Details` uses a compact ghost action.
- `Remove` uses a compact ghost action with destructive text and destructive hover treatment.
- Do not add selection checkboxes, avatars, status badges, or row-level overflow menus.

## Pagination

Pagination must exactly follow the current React Team page pattern.

- Keep pagination outside the bordered table container.
- Do not place an outer border or card around the table and pagination together.
- Use a standalone row with approximately `16px` vertical padding.
- Left: result summary, for example `Showing 1 to 6 of 24 groups`.
- Right: previous/next controls, compact page buttons, and a page-size selector.
- Supported page sizes remain `10`, `20`, and `30`.
- The selected page uses the current outline treatment; other pages use ghost buttons.

## Destructive Action

Removing a group requires a destructive confirmation dialog that names the group and states that the operation cannot be reverted. While the request is in flight, disable the confirm action and show its saving label. On success, remove the row, update the total count, and show a translated Sonner toast.

Do not use the Angular popconfirm visual treatment.

## States

- **Loading:** keep the header and toolbar visible and show compact table skeleton rows.
- **Load error:** show a translated inline error with Retry above the table content.
- **Empty list:** show `No groups yet` with `Add group` as the recovery action.
- **No search results:** state that no groups match the current name filter and provide `Clear search`.
- **Mutation success or failure:** use translated Sonner toasts without navigating away from the current list context.

## Semantic Style Contract

- Use `background`, `foreground`, `muted-foreground`, `border`, `muted`, `primary`, and `destructive` tokens.
- Keep the page flat. Use borders and neutral state layers instead of shadows.
- Use current shared shadcn components without modifying generated files.
- Keep light and dark themes structurally identical; do not hard-code light-theme colors in feature code.
- Do not recreate Angular/ng-zorro styling or introduce FeatBit-green table/actions.

## Internationalization And Accessibility

- All user-visible copy belongs in the IAM translation resource.
- English and Chinese routes preserve the same layout and hierarchy.
- Copy, search, action, pagination, Sheet, error, and empty-state labels must be translated.
- Preserve shadcn/Base UI keyboard behavior and visible focus rings.
- Provide accessible names for the copy icon and other icon-only controls.
- Destructive state must not rely on color alone; confirmation copy must state the action.

## Acceptance Criteria

- The Group list follows the current React Team list header, toolbar, table, and pagination structure.
- The table columns are exactly Name, Description, and Actions.
- Resource name appears on the second line of the Name cell and never in a separate column.
- Each Resource name has a copy action and uses monospaced muted text.
- Pagination sits outside the table border and has no large enclosing border.
- `Add group` opens a compact right-side Sheet without changing the list layout.
- Details navigates to the Group Team tab.
- Remove uses an explicit destructive confirmation.
- Loading, error, empty, and search-empty states provide clear recovery actions.
- Light and dark themes use semantic tokens, and English/Chinese routes remain translated.

