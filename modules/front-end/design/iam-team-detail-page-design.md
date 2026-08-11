# IAM Team Detail Page Design

This document is the React design contract for the IAM Team member detail page. Angular remains a functional reference for API behavior and permission relationships, but the React page must use the authenticated shell, shadcn/ui, Base UI primitives, Tailwind semantic tokens, and the compact workbench language defined in [react-layout-design.md](react-layout-design.md).

## Design Asset

- Team member detail, Groups tab, light theme: [iam-team-detail-page-light.png](iam-team-detail-page-light.png)
- Add to group Sheet, light theme: [iam-team-detail-add-to-group-sheet-light.png](iam-team-detail-add-to-group-sheet-light.png)

The saved image is the required baseline for information hierarchy, density, spacing, and semantic color usage. Text values and row data are illustrative; the structure and interaction model are normative.

## Route And Page Scope

- The member detail route is `/:lang/iam/team/:memberId/:tab`.
- Supported tabs are `groups`, `direct-policies`, and `inherited-policies`.
- Opening a member from the Team list defaults to the `groups` tab.
- The authenticated sidebar and top Organization / Project / Environment context bar remain visible.
- IAM stays expanded in the sidebar and Team remains the active sub-item.
- Design for professional desktop workflows first. Do not introduce a separate mobile composition unless that scope is requested later.

## Compact Member Header

The page header exposes identity and the one member-level destructive action without using a summary card.

1. A back link labeled `Team` returns to the Team list while preserving useful list state when practical.
2. The member name is the page title. If no name exists, use the email as the title.
3. Show the member email once, directly below the title.
4. Show one compact metadata row below the email:
   - label `Resource name (RN)`;
   - monospaced value without repeating the `rn:` prefix in the visible value;
   - copy icon immediately after the value.
5. Place the outline destructive `Remove member` action at the far right of the header.

Do not add an avatar, role badge, organization field, metrics, or a bordered identity card. Organization is already visible in the authenticated context bar, and email must not be repeated in a second summary surface.

### Header Spacing

- Back link to title: `20-24px`.
- Title to email: approximately `4px`.
- Email to the Resource name row: approximately `12px`.
- Resource name row height: `28-30px`.
- Resource name row to tabs: approximately `24px`.

The title, email, and Resource name must read as one compact identity group. Avoid large blank bands above or below the Resource name row.

## Tabs

Use a full-width, URL-backed tab row immediately below the member header:

- `Groups` with its current relationship count;
- `Direct policies` with its current relationship count;
- `Inherited policies` with its current relationship count.

Counts use compact neutral badges. The active tab uses stronger text and a thin foreground underline. Tabs must not use saturated fills or card-like containers.

## Groups Tab

The Groups tab shows only groups the current member has already joined.

### Toolbar

- Left: search input with `Filter by group name`.
- Right: primary action `Add to group`.
- Do not add an `All groups` / `Containing current member` selector. Available groups belong in the add flow, not in the membership table.

### Table

Use a bordered TanStack Table with server-side search and pagination where the API supports them.

| Column | Content |
| --- | --- |
| Name | Group name; opens the Group detail page when selected. |
| Description | Group description with normal body styling. |
| Membership | Compact neutral badge such as `Direct member`. |
| Actions | `Details` and destructive `Remove` only. |

The table must not show groups the member has not joined, `Not a member` rows, or row-level `Add` actions. The page-level `Add to group` action owns the add workflow.

Keep pagination outside the bordered table: result summary on the left and compact page controls plus page-size selector on the right.

## Add To Group Sheet

Clicking `Add to group` opens a right-side shadcn `Sheet` without changing the underlying detail-page structure.

The sheet contains:

1. Title `Add <member name> to groups`.
2. Search input for group name.
3. Available groups the member has not joined.
4. Multi-selection with selected values shown as removable compact chips.
5. Sticky footer with one right-aligned primary action labeled `Add`.

The selected-items area shows the current selection count, for example `2 selected`; do not repeat that count in the submit-button label. The `Add` action is disabled until at least one group is selected. On success, close the sheet, refresh the Groups table and tab count, and show a translated success toast. If no groups remain available, show `This member already belongs to every available group.` instead of an empty result list.

## Direct Policies Tab

Show only policies assigned directly to the member.

- Toolbar: `Filter by policy name` and right-aligned `Add policy`.
- Table columns: `Name`, `Type`, `Description`, and `Actions`.
- System-managed policies use the shared star icon and `System` metadata without custom saturated fills.
- Actions are `Details` and destructive `Remove`.
- `Add policy` uses the same right-side searchable multi-select Sheet model as `Add to group`, excluding policies already assigned directly.

Do not mix inherited policies into this table.

## Inherited Policies Tab

Inherited policies are read-only relationships provided by group membership.

- Toolbar: `Filter by policy name` only.
- Table columns: `Name`, `Group`, `Type`, `Description`, and `Actions`.
- `Details` opens the Policy detail page.
- Do not show Add or Remove actions. Changes must be made through the source Group or its policy assignment.
- The Group column identifies the inheritance source and links to Group detail when practical.

## Destructive Actions

### Remove From Group Or Direct Policy

Use a confirmation dialog that names the relationship being removed. While saving, disable the confirm action and show its in-flight label. On success, refresh the current table and tab count.

### Remove Member

The header action opens a destructive confirmation dialog. The dialog must state the scope clearly:

- removing from the current organization; or
- removing from the entire workspace when that operation is available and explicitly selected.

Do not combine both scopes behind an ambiguous single confirmation. The current authenticated user cannot remove themselves when backend rules prohibit it.

## States

- **Loading:** retain the member-header and tab structure and use compact skeleton rows for changing content.
- **Member load error:** show a translated inline error with Retry near the header; do not render misleading empty identity values.
- **Tab load error:** keep the header and tabs available, then show an inline error with Retry in the tab content area.
- **Empty Groups:** `This member is not in any groups yet.` with `Add to group` as the recovery action.
- **Empty Direct policies:** `No policies are assigned directly to this member.` with `Add policy` as the recovery action.
- **Empty Inherited policies:** `No policies are inherited through groups.` without an add action.
- **No search results:** state that nothing matches the current query and provide `Clear search`.
- **Mutation success or failure:** use translated Sonner toasts and keep the current page context visible.

## Semantic Style Contract

- Use `background`, `foreground`, `muted-foreground`, `border`, `accent`, `primary`, and `destructive` tokens.
- Keep the page flat. Use borders and tonal layers instead of ambient shadows.
- Default controls are approximately `32-36px` tall with restrained `6-10px` radii.
- Body and table text use the established compact `14px` scale.
- Use destructive red only for destructive labels, borders, and confirmation actions.
- Keep light and dark themes structurally identical; do not hard-code light-theme colors.

## Internationalization And Accessibility

- All user-visible copy belongs in the IAM translation resource.
- English and Chinese routes must preserve the same layout and hierarchy.
- Long names, emails, resource names, group names, and translated labels must truncate safely and expose their full value through the established tooltip pattern where needed.
- Preserve shadcn/Base UI keyboard behavior and visible focus rings.
- Provide accessible names for copy and other icon-only actions.
- Selection, membership, and destructive state must not rely on color alone.

## Acceptance Criteria

- Member identity is compact and contains no duplicate Email or Organization field.
- `Resource name (RN)` appears directly below the email with a copy action and no large surrounding card.
- The page exposes Groups, Direct policies, and Inherited policies as URL-backed tabs with counts.
- The Groups table contains joined groups only and has no membership filter or Add row action.
- `Add to group` opens a searchable multi-select Sheet containing only available groups.
- The Add to group Sheet shows selection count in the selected-items area and uses the fixed footer action label `Add`.
- Direct policies and inherited policies remain separate; inherited relationships are read-only.
- Destructive actions show explicit scope and confirmation.
- Loading, error, empty, search-empty, and mutation states provide clear recovery paths.
- The page follows the current React authenticated shell and shadcn semantic styling in light and dark themes.
- English and Chinese routes show translated IAM copy.
