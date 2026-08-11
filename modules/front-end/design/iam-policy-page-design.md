# IAM Policy Page Design

This document is the React design contract for the IAM Policy list page, its `Add policy` sheet, and the Policy details page. Angular remains the functional reference for Policy data, API behavior, relationship semantics, and managed-policy restrictions, but the React implementation must follow the current IAM Team and Group pages and their shadcn/ui, Base UI, Tailwind, TanStack Table, and authenticated-shell conventions.

The current Policy details scope includes the Team and Groups relationship tabs. Permissions intentionally remains a placeholder until the permission editor receives its own implementation contract.

## Required Design

- Policy list, light theme: [iam-policy-list-light.png](iam-policy-list-light.png)
- Policy details, Permissions placeholder: [iam-policy-details-permission.png](iam-policy-details-permission.png)
- Policy details, Team tab: [iam-policy-details-team.png](iam-policy-details-team.png)
- Policy details, Groups tab: [iam-policy-details-groups.png](iam-policy-details-groups.png)

The saved images are the required baseline for hierarchy, density, spacing, table structure, and semantic color usage. Row data is illustrative. The implemented React Team and Group pages remain authoritative when an image and reusable component behavior differ. For the details header, the first approved design establishes the structure; the later Team and Groups images preserve that header while showing the relationship content.

## Route And Page Scope

- The list route is `/:lang/iam/policies`.
- The detail routes are `/:lang/iam/policies/:policyId/permission`, `/:lang/iam/policies/:policyId/team`, and `/:lang/iam/policies/:policyId/groups`.
- Keep the authenticated sidebar and Organization / Project / Environment context bar unchanged.
- IAM stays expanded and Policies is the active navigation item.
- This contract covers the list page, create Sheet, list states, pagination, copy action, destructive removal flow, Policy details header, Team and Groups relationships, and the temporary Permissions placeholder.
- The structured permission editor and permission-statement mutation flows remain outside the current page scope.
- Design for professional desktop workflows first; do not introduce a separate mobile composition unless requested.

## Page Header

Use the same header rhythm as the current React Team and Group list pages:

- title: `Policies`;
- subtitle: `Manage policies and control access across your organization.`;
- main content padding: approximately `32px` horizontally and `24px` vertically;
- title size: `24px`, semibold;
- subtitle size: `14px`, muted;
- header-to-toolbar spacing: approximately `40px`.

Do not add tabs, metrics, summary cards, IAM explanations, decorative content, or policy-type counts above the list.

## Toolbar

- Left: a `320px` search input with the placeholder `Filter by name`.
- Right: the default primary action `Add policy` with a leading plus icon.
- Inputs and buttons use the current IAM list-page compact control height.
- Keep approximately `20px` between the toolbar and table.
- Search is debounced by approximately `300ms` and resets pagination to page one.

Do not add a Type filter, status filter, segmented control, bulk actions, or secondary toolbar in this version.

## Table

Use a bordered TanStack Table with server-side search and pagination.

| Column | Content |
| --- | --- |
| Name | Two-line identity block: policy name on the first line; copy icon and Resource name on the second line. |
| Type | Plain inline `System Managed` or `Customer Managed` text. System-managed policies include a small muted star icon. |
| Description | Policy description; show `-` when empty and expose truncated content in a tooltip. |
| Actions | `Details`; customer-managed policies additionally show destructive `Remove`. |

### Two-Line Resource Name Rule

Resource name must never occupy a separate table column.

Each Name cell uses the same two-line pattern established by the current React Group list and IAM relationship tables:

1. First line: policy name as semibold link text. It opens `/:lang/iam/policies/:policyId/permission`.
2. Second line: a compact ghost copy icon followed by the monospaced Resource name, for example `policy/developer`.

The second line uses compact muted text and a small vertical gap from the name. Long policy names and Resource names truncate safely and expose the full value through the established tooltip pattern.

### Managed Policy Rule

`System Managed` is a behavioral state, not a decorative badge.

- Use a small muted outline star and plain text.
- Do not use green, blue, or filled badges to represent the type.
- System-managed policies show `Details` only and must never expose `Remove`.
- Customer-managed policies show plain `Customer Managed` text and may expose `Details` and `Remove`.
- Unknown policy types render `-` rather than guessing a management state.

### Table Geometry

- The table is the only bordered container in the list area.
- Use one subtle border, a restrained `6px`-like radius, and no ambient shadow.
- Header and body cells use approximately `20px` horizontal and `16px` vertical padding.
- Keep the declared column widths and table minimum width internally consistent.
- Rows use thin dividers and the current neutral hover state.
- `Details` uses a compact ghost action.
- `Remove` uses a compact ghost action with destructive text and destructive hover treatment.
- Do not add selection checkboxes, avatars, colored type pills, row numbers, a separate Resource name column, or row-level overflow menus.

## Add Policy Sheet

`Add policy` opens a right-side shadcn `Sheet`, approximately `500px` wide on desktop and constrained to the viewport on smaller screens. Opening the Sheet must not change the underlying list layout.

The Sheet contains:

1. Header with `Add policy` and the standard close action.
2. Required Name field.
3. Required Key field, initially generated from Name and still editable.
4. Short Key helper text describing the allowed characters and Resource name role.
5. Optional Description field.
6. Footer with a right-aligned `Save` primary action.

Validation and submission behavior:

- Name cannot be empty.
- Key cannot be empty and may contain only letters, numbers, periods, underscores, and hyphens.
- Key availability is checked through the existing API before creation.
- Show translated field-level validation without replacing the Sheet content.
- Disable Save and show its saving label while the request is in flight.
- On success, close the Sheet, refresh the current list, and show a translated Sonner toast.
- On failure, keep the Sheet open and show a translated failure toast.

Do not add policy statements or the structured permission editor to this Sheet. Those belong to the future Policy detail/editor contract.

## Pagination

Pagination must follow the current React Team and Group page pattern.

- Keep pagination outside the bordered table container.
- Do not place an outer border or card around the table and pagination together.
- Use a standalone row with approximately `16px` vertical padding.
- Left: translated result summary, for example `Showing 1 to 5 of 5 policies`.
- Right: previous/next controls, compact page buttons, and a page-size selector.
- Supported page sizes remain `10`, `20`, and `30`.
- The selected page uses the current outline treatment; other pages use ghost buttons.
- Previous and Next icon buttons require translated accessible names.

## Destructive Action

Removing a customer-managed policy requires a destructive confirmation dialog that names the policy and states that the operation cannot be reverted. While the request is in flight, disable the confirm action and show its saving label. On success, remove the row, update the total count, and show a translated Sonner toast.

The UI and confirmation handler must both prevent removal of a system-managed policy. Do not use the Angular popconfirm visual treatment.

## Policy Details

### Detail Navigation

- Opening `Details` from the Policy list enters the Permissions route.
- Direct visits to the Team and Groups routes keep the corresponding tab active.
- A missing or unsupported detail tab redirects to Permissions without changing the selected policy.
- The authenticated header, context bar, sidebar geometry, and IAM menu behavior remain unchanged.
- The Policies sidebar item remains active for every `/:lang/iam/policies/:policyId/*` route.

### Details Header

Preserve the approved first-version header instead of substituting the current Team or Group detail header.

1. A compact back link labeled `Policies` returns to the Policy list.
2. The Policy name is the primary `24px`-like semibold heading.
3. Customer-managed policies expose a compact pencil action beside the name; system-managed policies do not.
4. The description sits below the name in muted body text. Customer-managed policies expose the same compact edit affordance beside it.
5. The third line contains a segmented Resource name control: `RN`, the monospaced `policy/{key}` value, and a copy action.
6. Policy type appears immediately after the Resource name as a standard compact shadcn `Badge`, using the neutral `secondary` treatment and approximately `20px` height.
7. Customer-managed policies expose a destructive-outline `Remove policy` action at the far right. System-managed policies hide it.

The details Badge is intentionally different from the list table: the list keeps Type as plain inline text for scan efficiency, while the details header uses a compact Badge to identify persistent metadata. Do not render the Badge as a button-like `32px` box or introduce a custom colored status pill.

### Tabs And Counters

Use the underline tab style already established by the actual React Team and Group detail implementations:

- tabs are ordered `Permissions`, `Team`, and `Groups`;
- each label includes a compact neutral count Badge;
- Permission count derives from the loaded policy statement count;
- Team and Groups counts are fetched when the details page first loads, regardless of the active tab;
- counters must not remain empty until their tab is clicked;
- successful add or remove mutations refresh the affected relationship content and its counter;
- counter-loading failures must not block the active tab content or header.

### Permissions Placeholder

Permissions is intentionally non-functional in this phase. Render a restrained dashed bordered empty surface with:

- title: `Permissions editor coming next`;
- supporting copy: `Team and group assignments are available now. Permission statements will be added in the next step.`

Do not display a partial rule builder, editable JSON, fake permission rows, or disabled controls that imply the editor is already available.

### Team Tab

The Policy Team tab follows the Team relationship tab on the current React Group details page.

- Toolbar: `Filter by email` search on the left and primary `Add member` with a plus icon on the right.
- Search is debounced by approximately `300ms` and returns to page one.
- Table columns are Name, Email, and Actions.
- Name uses a two-line identity block: semibold member link, then copy action plus monospaced `member/{email}` Resource name.
- Actions are compact `Details` and destructive `Remove` controls.
- `Add member` opens the shared relationship-picker Sheet with available and selected members, remote search, multi-select, and incremental loading/pagination.
- An empty relationship list keeps the toolbar visible and offers `Add member` as the recovery action.

### Groups Tab

The Policy Groups tab follows the Groups relationship tab on the current React Team details page.

- Toolbar: `Filter by group name` search on the left and primary `Add to groups` on the right.
- Search is debounced by approximately `300ms` and returns to page one.
- Table columns are Name, Description, and Actions.
- Name uses a two-line identity block: semibold group link, then copy action plus monospaced `group/{name}` Resource name.
- Empty descriptions render `-` and long content uses the established tooltip pattern.
- Actions are compact `Details` and destructive `Remove` controls.
- `Add to groups` opens the shared relationship-picker Sheet with available and selected groups, remote search, multi-select, and incremental loading/pagination.
- An empty relationship list keeps the toolbar visible and offers `Add to groups` as the recovery action.

### Relationship Removal Dialogs

Removal confirmations use the same shadcn destructive dialog structure as the implemented Team and Group relationship flows, while preserving the Angular meaning exactly. The affected entity name is visually emphasized with semibold or bold inline text.

- Member: `Are you sure to remove the member ` **{member name}** ` from the current policy?`
- Group: `Are you sure to remove the policy from the group ` **{group name}** `?`

Do not replace the object name with a generic noun, put it on an unrelated line, or rely only on the dialog title to establish what will be removed. Disable confirmation while the mutation is running and keep the dialog open on failure.

### Detail Pagination And States

- Relationship tabs use the same standalone pagination row as the existing React Team and Group details pages.
- The default page size is `20`; supported sizes are `10`, `20`, and `30`.
- Keep pagination outside the bordered table and use zero-based API page indexes internally.
- The details header has dedicated loading skeleton and error recovery states.
- Relationship tables have compact loading skeletons, inline errors with Retry, empty states, and translated Sonner success/failure toasts.
- Header, tabs, toolbar, and pagination must remain stable while table data changes.

## States

- **Loading:** keep the header and toolbar visible and show five compact table skeleton rows using the same vertical density as loaded rows.
- **Load error:** show a translated inline error with Retry above the table.
- **Empty list:** show `No policies yet.` with `Add policy` as the recovery action.
- **No search results:** show `No policies match this name.` and provide `Clear search`.
- **Mutation success or failure:** use translated Sonner toasts without navigating away from the current list context.
- **Long content:** truncate Name metadata and Description without changing row geometry; provide tooltips for the full value.
- **Unknown type:** show `-` and do not expose destructive behavior based on an assumed type.

## Semantic Style Contract

- Use `background`, `foreground`, `muted-foreground`, `border`, `muted`, `primary`, and `destructive` tokens.
- Keep the page flat. Use borders and neutral state layers instead of shadows.
- Use current shared shadcn components without modifying generated files.
- Use Lucide icons at the established compact scale.
- Keep light and dark themes structurally identical; do not hard-code light-theme colors in feature code.
- Do not recreate Angular/ng-zorro styling or introduce FeatBit-green table/actions.
- Do not add gradients, glass effects, oversized radii, decorative cards, or marketing-page composition.

## API And Data Contract

- List: `GET /api/v1/policies` with `name`, zero-based `pageIndex`, and `pageSize` query parameters.
- Details: load the selected Policy, including type, key, description, and statements required by the header and Permissions count.
- Key availability: `GET /api/v1/policies/is-key-used?key=...`.
- Create: `POST /api/v1/policies` with `name`, `key`, and `description`.
- Remove: `DELETE /api/v1/policies/:policyId` for customer-managed policies only.
- Team list and count: `GET /api/v1/policies/:policyId/members` with `searchText`, `getAllMembers`, zero-based `pageIndex`, and `pageSize`.
- Add member: `PUT /api/v1/members/:memberId/add-policy/:policyId`.
- Remove member: `PUT /api/v1/members/:memberId/remove-policy/:policyId`.
- Groups list and count: `GET /api/v1/policies/:policyId/groups` with `name`, `getAllGroups`, zero-based `pageIndex`, and `pageSize`.
- Add group: `PUT /api/v1/groups/:groupId/add-policy/:policyId`.
- Remove group: `PUT /api/v1/groups/:groupId/remove-policy/:policyId`.
- Resource name: `policy/{key}`, with the policy id used only as a defensive fallback when Key is absent.
- Policy types preserve the backend values `SysManaged` and `CustomerManaged`.
- All requests use the shared authenticated API client and current Workspace / Organization headers.
- Relationship counts load independently of tab selection and are invalidated with the corresponding relationship query after mutations.

## Internationalization And Accessibility

- All user-visible copy belongs in the IAM translation resource.
- English and Chinese routes preserve the same layout and hierarchy.
- List and detail headers, tabs, counters, search, table, policy types, actions, pagination, Sheets, validation, dialogs, error states, placeholders, empty states, and toast labels must be translated.
- Preserve shadcn/Base UI keyboard behavior and visible focus rings.
- Associate Sheet labels with their fields and expose validation state through the existing form pattern.
- Provide accessible names for copy, pagination, and other icon-only controls.
- Destructive state must not rely on color alone; the confirmation copy must name the action and consequence.
- System-managed status must not rely on the star alone; retain the translated text label.

## Code Organization And Boundaries

Keep all feature implementation under `front-end/src/features/iam/policies/` and follow the responsibility split used by Groups:

- `policy-api.ts`: Policy types and API operations.
- `index/index-page.tsx`: list-page orchestration and state.
- `index/components/policy-columns.tsx`: table column definitions and row presentation.
- `index/components/policy-data-table.tsx`: TanStack Table rendering and loading/empty states.
- `index/components/policy-pagination.tsx`: server-side pagination controls.
- `index/components/add-policy-sheet.tsx`: create form and validation.
- `index/components/remove-policy-dialog.tsx`: destructive confirmation.
- `details/details-page.tsx`: detail-route orchestration, header query, tab selection, and eager relationship counters.
- `details/policy-details-api.ts`: detail and relationship API operations.
- `details/components/policy-details-header.tsx`: approved Policy header, Resource name copy control, Type Badge, edit affordances, and managed-policy actions.
- `details/components/policy-relationships.tsx`: Team and Groups toolbars, tables, pickers, pagination, empty states, and removal dialogs.

Only route registration and IAM translation resources may live outside this feature directory as required integration points. Do not modify shared shadcn component source for Policy-specific needs. Reuse Team and Groups behavior without changing those feature modules, and do not change unrelated layout modules as part of this contract.

## Acceptance Criteria

- The Policy list follows the current React Team and Group list header, toolbar, table, and pagination structure.
- The toolbar contains only Name search and `Add policy`; no Type filter is present.
- The table columns are exactly Name, Type, Description, and Actions.
- Resource name appears on the second line of the Name cell and never in a separate column.
- Each Resource name has a copy action and uses monospaced muted text.
- System-managed policies use a muted star plus text and never expose Remove.
- Customer-managed policies expose Details and Remove.
- Pagination sits outside the table border and has no large enclosing card.
- `Add policy` opens a compact right-side Sheet without changing the list layout.
- Name, Key, Key availability, submission, and translated error states behave as specified.
- Remove uses an explicit destructive confirmation and is guarded in both UI and handler logic.
- Loading, error, empty, and search-empty states provide clear recovery actions.
- Light and dark themes use semantic tokens, and English/Chinese routes remain translated.
- The page is verified on the local development route `http://localhost:4200/:lang/iam/policies`.
- The details header follows the approved first-version composition and displays Policy Type as a compact shadcn Badge beside the Resource name.
- System-managed policies hide name/description editing and destructive removal; customer-managed policies expose them.
- Details tabs are exactly Permissions, Team, and Groups and use the existing React underline treatment.
- Team and Groups counters load on initial details-page entry and do not wait for the user to click each tab.
- Permissions displays only the documented placeholder in this phase.
- Team mirrors the Group-details member relationship pattern; Groups mirrors the Team-details group relationship pattern.
- Relationship searches debounce and reset pagination, and add/remove mutations refresh both the table and counter.
- Remove-member and remove-group dialogs use the documented Angular-equivalent copy and emphasize the affected member or group name.
- Details are verified on `http://localhost:4200/:lang/iam/policies/:policyId/permission`, `/team`, and `/groups`.
