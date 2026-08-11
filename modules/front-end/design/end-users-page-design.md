# End Users Page Design

This document defines the React design target for the environment-level `End Users` main page. Angular is the functional reference; the existing React Workspace `Global Users` page is the visual and interaction reference.

Do not change the authenticated sidebar, context bar, account menu, subscription badge, or surrounding application shell. The design starts inside the existing main content area for the `/end-users` route.

## Design Assets

- Main page light concept: [end-users-page-light.png](end-users-page-light.png)
- Evaluate action light concept: [end-users-evaluate-light.png](end-users-evaluate-light.png)
- Details action light concept: [end-users-details-light.png](end-users-details-light.png)
- Properties action light concept: [end-users-properties-light.png](end-users-properties-light.png)
- Property preset values light concept: [end-users-property-presets-light.png](end-users-property-presets-light.png)

The main-page image defines the accepted default hierarchy and density below the page header. The Evaluate, Details, and Properties images define the accepted right-drawer interaction states and keep the same End Users page visible behind them. The preset-values image defines the nested local-edit dialog. All images intentionally exclude the sidebar and context bar. Generated sample data is illustrative only; implementation must render API data.

## Finalized Design Decisions

These decisions supersede earlier exploration and are the implementation target:

- Scope is limited to the End Users main content and its action overlays. Do not change the sidebar, context bar, or application shell.
- The main table, Display menu, row actions, Evaluate drawer, and Details drawer use the existing React Global Users page as their consistency reference.
- The toolbar action is labeled `Import`, not `Upload`. The underlying upload endpoint and Upload icon remain unchanged.
- The End Users list keeps cursor-only `Prev` and `Next` pagination. It must not show numbered pages or a `Showing x to y of z users` summary because the list response has no total count.
- The Evaluate drawer may show numbered Feature Flags pagination and a total summary because the nested flags response provides `totalCount`.
- Details uses the same `Built-in properties` and `Custom properties` definition-row structure as Global Users, while retaining End Users property search.
- Details does not show property comments. Comments describe environment property definitions and belong in the Properties management drawer.
- Properties is a wide management drawer. `Add property` is primary; Edit and Preset values are lightweight row actions; destructive Remove is in the row overflow menu.
- Preset values are edited as a local modal draft. Saving the modal must not submit a parent form, close the Properties drawer, refresh its list, or reset the End Users page.
- Opening and closing any drawer must preserve main-page search, displayed columns, page size, and cursor position.

## Scope And Principles

- Preserve every Angular End Users capability and backend contract.
- Redesign the presentation for the React workbench rather than cloning ng-zorro.
- Match the current React Global Users table: compact controls, neutral shadcn surfaces, thin borders, restrained color, and lightweight row actions.
- Keep the page table-first. Include the standard compact page header used by adjacent React environment pages, but do not add summary cards, avatars, decorative empty-state art, or another navigation layer.
- Treat the current organization, project, and environment from the existing context bar as authoritative. Do not repeat that context inside the page.
- Use the shared React patterns and native shadcn/Base UI primitives. Do not modify generated files in `src/components/ui` for feature-specific needs.

## Functional Inventory From Angular

The React migration must preserve:

- Environment-scoped user search by `name` or `keyId`, debounced by 400 ms.
- Cursor-based user pagination with page sizes `10`, `20`, and `30`.
- Built-in `Name` and `Key ID` columns.
- Optional columns sourced from environment user-property definitions.
- Per-environment persistence of selected optional columns.
- Preset-value descriptions in optional property cells.
- JSON import with the End Users template and a 500 MB limit.
- Environment user-property management, including digest fields, comments, preset values, and removal.
- Download of users matching the current filters, including the 50,000-result limit.
- Per-user feature-flag evaluation and segment relationships.
- Searchable built-in and customized user-property details.

## Main Page Layout

Content order:

1. Standard page header: `End Users` with a concise environment-scoped description
2. Compact toolbar
3. Single bordered data table
4. Cursor pagination row

Use the same main-content width and page padding as the surrounding React authenticated pages. The toolbar sits directly above the table with approximately 20 px of separation from the table. The table is a single `background` surface with a neutral border and small radius; do not wrap it in another card.

### Toolbar

Left group:

- Search input, approximately 320 px wide.
- Search icon and placeholder `Search by name or keyId`.
- `Display` outline button immediately after search, using the same searchable column menu as Global Users.

Right group:

- `Import` outline button with Upload icon.
- `Properties` primary button with Settings icon. This is the main environment-configuration action.
- Compact outline ellipsis button containing `Download`.

Do not make both `Import` and `Properties` primary. The hierarchy in the accepted design is intentional: property configuration is the stronger page-level action, while import is occasional data ingress and download is secondary.

### Display Menu

- Populate choices from `GET /api/v1/envs/{envId}/end-user-properties` rather than discovering them only from loaded user rows.
- Exclude built-in properties from the optional list.
- Include a client-side `Search columns` field.
- Render checkbox items for matching property names.
- Include `Clear all` only when at least one optional column is selected.
- Show `No columns found` when the local filter has no matches.
- Do not make a user-list request when filtering this menu.
- Persist selected property names per environment, matching Angular's `CURRENT_USER_FILTER_ATTRIBUTE(envId)` behavior.

## Data Table

Use TanStack Table for rendering. The user-list API is cursor-based and does not expose sorting, so headers must not show sort affordances.

Default columns:

- `Name`
- `Key ID`
- Selected environment-property columns
- `Actions`

Cell behavior:

- `Name`: primary row text and the natural entry point to Details. If empty, show muted `Unnamed user`.
- `Key ID`: monospace or identifier styling; truncate long values and reveal the full value in a tooltip.
- Optional property: plain text, truncated with an overflow tooltip. Missing values render a muted dash.
- If a property value matches a configured preset value, render `Description (rawValue)`, matching Angular behavior. The raw value must remain visible because targeting rules use it.
- `Actions`: compact text actions `Evaluate` and `Details`, separated by a thin vertical divider. They must remain lighter than toolbar actions.

Use consistent vertical centering. Keep the table dense enough for ten rows on a typical desktop screen without making row targets cramped. Do not add avatars, badges for ordinary strings, or colored row backgrounds.

### Cursor Pagination

The End Users list does not have a total-count contract. Do not reuse Global Users numbered pagination or show a fabricated `Showing x to y of z users` summary.

- Right-align `Prev`, `Next`, and the page-size selector below the table.
- Disable `Prev` when no `previousCursor` exists.
- Disable `Next` when no `nextCursor` exists.
- Disable pagination controls while the list request is loading.
- Page-size choices are `10 / page`, `20 / page`, and `30 / page`.
- Changing search text or page size clears both cursors and returns to the initial result set.

## Main Page States

### Loading

- Keep the toolbar visible.
- Disable actions that would conflict with loading.
- Render skeleton rows matching the visible column count.
- Preserve table dimensions to avoid layout movement.

### Empty

- No search: `No end users yet` with secondary `Import users` action.
- Active search: `No users match your search` with `Clear search` action.
- Keep the message inside the bordered table surface; do not add an illustration.

### Error

- Show an inline destructive-tinted alert at the top of the table surface.
- Message: `Failed to load data`.
- Include a compact `Retry` action.
- Keep the toolbar available so the user can change or clear the search.

### Action Feedback

- Successful copy, import, property mutation, and download initiation use the existing React status/toast pattern.
- Failed mutations keep the relevant overlay open and show a recoverable inline error or toast.
- Destructive property removal requires confirmation and must clearly state that it cannot be reverted.

## Supporting Actions

Supporting surfaces preserve Angular behavior and reuse the accepted Global Users overlays where their behavior is identical. Evaluate, Details, Properties, and Preset values now have accepted design assets; Import and Download remain behaviorally specified in this document.

### Import Users

- Centered modal, about 560 px wide on desktop.
- Template: `assets/upload-end-users.json`.
- Endpoint: `POST /api/v1/envs/{envId}/end-users/upload`.
- Accept JSON only and reject files of 500 MB or more before upload.
- Explain that records are created or updated by `keyId` and that new properties are added without removing existing properties.
- On success, close the modal and reload the first user-list result using the current search and page size.

### Evaluate

Accepted concept: [end-users-evaluate-light.png](end-users-evaluate-light.png).

Reuse the Global Users Evaluate drawer visual structure and interaction model:

- Right drawer, approximately 920-960 px wide.
- Overlay the current table instead of resizing it into a hard split view. Keep enough of the table visible to preserve user and filter context.
- Header shows the selected user's name as the title and key ID as secondary text, with Copy and Close actions.
- Copy success uses the existing page-level status/toast pattern.
- Tabs are `Feature Flags` and `Segments`; `Feature Flags` is active when the drawer first opens.

Feature Flags tab:

- Search placeholder: `Filter by name or key`.
- Debounce search by 400 ms and reset the flag page to 1.
- Use server-side pagination through `GET /api/v1/envs/{envId}/end-users/{userId}/flags`.
- The flags response includes `totalCount`, so this nested table may show `Showing 1 to 5 of 42 flags` and numbered pagination. This does not change the cursor-only pagination of the background End Users list.
- Columns: `Name`, `Key`, `Variation`, `Actions`.
- Keep headers plain unless the API and UI later expose an actual sort control.
- `Key` uses identifier styling and a compact copy action.
- `Variation` uses a small semantic marker and restrained value badge. Color distinguishes variation positions but is not the only carrier of the value.
- String and JSON variation values include an Expand action that opens a read-only code dialog with Format and Close actions.
- `Details` opens the feature flag Targeting page in a new browser tab.

Segments tab:

- Search placeholder: `Filter by name`.
- Load the selected user's segment relationships from `GET /api/v1/envs/{envId}/end-users/{userId}/segments`.
- Filter the returned collection locally by segment name.
- Columns: `Name`, `Type`, `Last updated`, `Actions`.
- Format `Last updated` in the current locale while keeping date and time visible.
- `Details` opens the segment Targeting page in a new browser tab.

Evaluate states:

- Loading: keep the header, tabs, and search visible; use row skeletons inside the active table.
- Empty Feature Flags: `No feature flags found`; distinguish an empty search with a Clear search action.
- Empty Segments: `This user does not belong to any segments`; distinguish an empty search with a Clear search action.
- Error: show a compact inline error with Retry inside the active tab without closing the drawer.
- Switching users resets both searches and nested pagination before loading the new user's data.
- Closing the drawer returns focus to the triggering `Evaluate` action and leaves the End Users list filters and cursor position unchanged.

### Details

Accepted concept: [end-users-details-light.png](end-users-details-light.png).

Use the Global Users profile drawer structure directly, with End Users retaining its property search:

- Right overlay drawer, approximately 500-540 px wide, with the End Users table still visible behind it.
- Do not resize the page into a hard split view or navigate away from the list.
- Header title: `User profile`.
- Show the selected user's name and key ID below the title, with Copy and Close actions matching Global Users.
- Search field: `Filter by property name or value`.
- Debounce the local property filter by approximately 100 ms, matching Angular behavior.
- Use the same two-column definition rows, bordered groups, spacing, and dividers as Global Users Details; do not render table headers.
- `Built-in properties` contains `keyId` and `name`.
- `Custom properties` contains all customized properties.
- Search filters rows across both groups by property name or value. Hide a group while it has no matching rows.
- Keep raw property values visible. Do not replace them with preset descriptions because this surface is the user's stored-data view.
- Add copy affordances for identifier-like or long values such as key ID and email.
- Truncate only when necessary and reveal the full value in a tooltip.
- Do not show `Comment` in Details. Comments describe the environment-level property definition rather than the selected user's data and remain available in the `Properties` management drawer.

Details states:

- Loading: preserve the header and search position while rendering compact row skeletons.
- No custom properties: keep `Built-in properties` visible and show a quiet `No custom properties` message beneath the `Custom properties` heading.
- Empty search result: `No properties match your search` with `Clear search`.
- Error: show a compact inline `Failed to load user details` message with Retry without closing the drawer.
- Closing the drawer returns focus to the triggering `Details` action and preserves the End Users search, displayed columns, and cursor position.

### Properties

Accepted concepts:

- Main drawer: [end-users-properties-light.png](end-users-properties-light.png)
- Preset values dialog: [end-users-property-presets-light.png](end-users-property-presets-light.png)

Use a wide right overlay drawer, approximately 850-920 px, so property administration remains connected to the current environment. Keep the End Users table visible behind it and do not resize the page into a hard split view.

Header and toolbar:

- Header title: `User properties`, with the standard Close action.
- Search placeholder: `Filter by name`; filtering is local and case-insensitive.
- Primary action: `Add property`. It is the only primary action in the drawer.

Property table:

- Columns: `Name`, `Digest field`, `Comment`, `Actions`.
- Keep all cells vertically centered and the Digest checkboxes horizontally centered in their column.
- Built-in properties remain visible. Their checkboxes reflect the saved state but are disabled, and Actions shows quiet `Built in` text.
- Custom properties show direct lightweight `Edit` and `Preset values (n)` actions.
- The preset count comes from the saved `presetValues` collection.
- Put destructive `Remove` inside the row ellipsis menu rather than repeating red actions across the table.
- Removal requires confirmation: `This operation cannot be reverted. Remove this property?`
- Use client-side pagination when the property count exceeds ten rows; searching returns to the first property page.

Add and edit behavior:

- `Add property` inserts an editable draft row in the table and moves to the page containing it.
- A new row contains Name, Digest field, Comment, Save, and Cancel controls.
- Name is required and must be unique within the environment.
- Cancel removes an unsaved row without an API call.
- Existing property names are immutable; `Edit` changes Comment inline while the Digest checkbox remains directly toggleable.
- Save and digest changes use `PUT /api/v1/envs/{envId}/end-user-properties/{propertyId}/upsert`.
- A successful create or edit updates the drawer row and the main page's Display choices without closing either surface.
- A failed save keeps the row editable and shows a recoverable error.

Preset values dialog:

- Open `Preset values (n)` in a centered modal over the still-open Properties drawer.
- Title: `Preset values for {propertyName}`.
- Creation fields: `Value` with helper `Used in targeting rules`, and `Description` with helper `Shown in the UI`.
- Disable `Add` until both fields contain non-whitespace text.
- Reject duplicate raw values within the local draft.
- Existing rows display raw Value and Description separately with a compact Remove action.
- `Clear all` is available only when values exist. It edits the local draft and remains reversible with Cancel.
- Checkbox label: `Only allow preset values`; map it to `usePresetValuesOnly`.
- If the final preset list is empty, force `Only allow preset values` off.
- Warning: `Values already used in targeting rules remain valid, but cannot be selected again after removal.`
- `Cancel` discards dialog changes. `Save` persists the entire property draft and updates the parent row's preset count.
- Dialog actions are local to the dialog: they must not submit a parent form, close the Properties drawer, refresh the property list, or reset the End Users page.

Properties states:

- Loading: keep the header and toolbar visible and render table-row skeletons.
- Empty: `No user properties yet` with `Add property`; built-in properties normally prevent this state.
- Empty search: `No properties match your search` with `Clear search`.
- Load error: compact inline `Failed to load user properties` with Retry.
- Mutation errors stay beside the affected row or inside the preset dialog; do not close the active surface.
- Closing the drawer returns focus to the main-page `Properties` button and preserves the End Users list state.

### Download

- `Download` lives in the toolbar ellipsis menu.
- Confirmation title: `Download End Users`.
- Explain that the JSON includes end users matching the current filters in the current environment.
- Endpoint: `POST /api/v1/envs/{envId}/end-users/download` with the current `searchText` and `pageSize` filter contract.
- Download filename: `end-users.json`.
- If the API returns `422` with `EndUserLimitExceeded`, keep the dialog open, show the 50,000-result limit message, disable Continue, and ask the user to narrow the filter.

## API And Data Contracts

```text
POST /api/v1/envs/{envId}/end-users/list
body:
  searchText: string
  cursor?: PageCursor
  pageSize: 10 | 20 | 30

response:
  items: EndUser[]
  previousCursor?: PageCursor
  nextCursor?: PageCursor
```

```text
GET    /api/v1/envs/{envId}/end-users/{userId}
POST   /api/v1/envs/{envId}/end-users/upload
POST   /api/v1/envs/{envId}/end-users/download
GET    /api/v1/envs/{envId}/end-users/{userId}/flags
GET    /api/v1/envs/{envId}/end-users/{userId}/segments
GET    /api/v1/envs/{envId}/end-user-properties
PUT    /api/v1/envs/{envId}/end-user-properties/{propertyId}/upsert
DELETE /api/v1/envs/{envId}/end-user-properties/{propertyId}
```

`EndUser` retains `id`, `keyId`, `name`, and `customizedProperties`. `EndUserProperty` retains `name`, `remark`, `isBuiltIn`, `isDigestField`, `presetValues`, and `usePresetValuesOnly`.

## Visual Direction

- Match [workspace-global-users-page-design.md](workspace-global-users-page-design.md) and its implemented React page.
- Use the project Inter typography and shadcn/Tailwind tokens.
- Use white/neutral surfaces, zinc borders, foreground text, muted secondary text, and a dark neutral primary button.
- Controls are approximately 32 px high with 6-10 px radii.
- Use borders and tonal hover states rather than ambient shadows.
- Icons are limited to Search, Columns, Upload for the Import action, Settings, Ellipsis, Copy, ExternalLink, and pagination chevrons where they clarify an action.
- Light and dark themes preserve identical hierarchy and spacing.
- Visible text must use `react-i18next` and work on `/en` and `/zh` routes.

## Acceptance Criteria For Later Implementation

- The page changes only the End Users main content surface.
- Visual hierarchy and density clearly match React Global Users.
- All Angular list, import, properties, download, evaluation, segment, and detail behaviors remain reachable.
- Main-page, Evaluate, Details, Properties, and Preset-values implementation matches the accepted design assets.
- Search uses a 400 ms debounce and resets cursor pagination.
- Display choices come from environment property definitions and persist per environment.
- Preset descriptions never hide raw targeting values.
- Pagination remains cursor-based, without numbered pages or a total count.
- Details uses Global Users property groups, retains property search, and does not display Comment.
- Properties owns Comment editing, Digest state, preset values, and property removal.
- Nested preset-value actions remain local and do not submit or reset a parent surface.
- Table headers do not suggest unsupported sorting.
- Loading, empty, search-empty, error, mutation, and download-limit states are specified.
- No code changes are required to understand or approve this design.
