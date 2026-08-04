# Workspace Global Users Tab Design

This document defines the React design target for the Workspace `Global Users` tab content only. Angular remains the functional reference, but React should use the existing authenticated layout, existing Workspace page frame, shadcn/ui primitives, Tailwind tokens, lucide-react icons, TanStack Query, TanStack Table, and `react-i18next`.

Do not change the authenticated layout, sidebar, top context bar, account menu, subscription/license badge, Workspace page header, or Workspace tabs when implementing this design. The design target starts inside the active `Global Users` tab panel.

## Design Assets

- Table page light concept: [workspace-global-users-table-light.png](workspace-global-users-table-light.png)
- Import action light concept: [workspace-global-users-import-light.png](workspace-global-users-import-light.png)
- Evaluate action light concept: [workspace-global-users-evaluate-light.png](workspace-global-users-evaluate-light.png)
- Details action light concept: [workspace-global-users-details-light.png](workspace-global-users-details-light.png)

The older full-page mockup [workspace-global-users-light.png](workspace-global-users-light.png) is retained as an exploration artifact only. It should not be used as the implementation target because it includes layout chrome and changes the page framing.

The first generated table/action drafts used a stronger drawer split, extra avatar color, and a generic admin palette. Treat those details as rejected exploration. The accepted direction must match the existing Workspace page visual language: white page surface, light gray bordered panels, restrained FeatBit blue primary actions, compact typography, subtle muted text, and no new decorative color system.

## Scope And Boundaries

This design covers only the content rendered inside the Workspace `Global Users` tab.

- Reuse the existing Workspace page header and tab style.
- Do not introduce another page header inside the tab.
- Do not add a nested sidebar, hero area, large summary band, or decorative content.
- Keep the tab body table-first and operational.
- Preserve the license-gated nature of Global Users.

## Angular Functional Reference

Angular currently provides these behaviors:

- Fetches `GET /api/v1/global-users` with `name`, zero-based `pageIndex`, and `pageSize`.
- Debounces search by 200 ms.
- Searches by user `name`.
- Uses server-side pagination with page sizes `10`, `20`, and `30`.
- Displays base columns `keyId`, `Name`, and `Actions`.
- Builds optional display-column choices from `customizedProperties` returned by loaded rows.
- Opens an import modal using `POST /api/v1/global-users/upload` and template asset `assets/upload-global-users.json`.
- Import accepts JSON files only and rejects files larger than 500 MB.
- Import success closes the modal and reloads the table.
- `Evaluate` opens a drawer showing selected-user feature flags and segments.
- `Details` opens a user profile drawer with built-in and customized properties.

Preserve these data and interaction behaviors in React.

## Phase 1: Table Page

Design the default tab content first. This is the primary page state before any action is clicked.

### Layout

Content order:

1. Toolbar
2. Data table
3. Pagination row

Do not repeat `Workspace` or `Global Users` as a large heading inside the tab body. The active tab is already the page label.

The table area should be a single neutral bordered surface with a compact toolbar above the table. Keep spacing consistent with the existing React Workspace tab style. Do not stretch the table mockup to fill an artificial 16:9 frame; preserve the content area's natural proportions.

### Toolbar

Left controls:

- Search input with Search icon.
- Placeholder: `Search by name`.
- Debounced search resets pagination to page 1.

- `Display` dropdown button with Columns or SlidersHorizontal icon, placed directly after search on the left side. Do not center this control between search and import.
- Dropdown opens directly with a small client-side search input above the checkbox list. Do not show a `Custom Columns` title/header inside the dropdown.
- Column search filters discovered custom property columns on the frontend only; it must not trigger a global users API request.
- Search placeholder: `Search columns`.
- Checkbox items show discovered custom property columns matching the current column-search text.
- Include selected columns as checked items.
- Selected columns remain selected even when filtered out by the column-search text.
- Include `Clear all` only when one or more custom columns are selected.
- If the column search has no matches, show a compact empty state: `No columns found`.

Right action:

- Primary `Import` button with Upload icon.
- This is the only primary action on the table page.

### Table

Use TanStack Table with server-side pagination.

Columns:

- `keyId`
- `Name`
- selected custom property columns
- `Actions`

Cell behavior:

- `keyId`: monospace, truncate long values, tooltip on overflow.
- `Name`: primary text. If empty, render muted `Unnamed user`. Do not introduce avatar initials unless the broader React table pattern later adopts avatars for users.
- Custom property cells: truncate long values, tooltip on overflow, muted dash for missing values. Use plain text by default; use badges only for values with real semantic status.
- `Actions`: show `Evaluate` and `Details` as compact neutral ghost/link buttons. Do not render `Evaluate` as blue outline or primary; both row actions should be visually lighter than `Import`.

Column behavior:

- Custom property columns are shown only when selected in `Display`.
- Discover custom property options from loaded rows, matching Angular behavior.
- Keep discovered options in memory across pages during the current tab session so the dropdown does not shrink while paginating.

Pagination:

- Page size options: `10`, `20`, `30`.
- UI page index is one-based.
- API page index remains zero-based.
- Show total count when available, for example `Showing 1 to 10 of 124 users`.

### Table States

Loading:

- Keep toolbar visible.
- Render skeleton rows matching the current visible columns.

Empty:

- No data and no active search: `No global users yet` with secondary `Import users`.
- Active search: `No users match your search` with `Clear search`.

Error:

- Inline alert above the table body: `Failed to load data`.
- Include a `Retry` action.

Gated:

- If Global Users is not licensed, replace the table body with a compact gated state:
  - Title: `Global Users is not enabled`
  - Body: `Enable the Global Users feature in your license to manage workspace-level users.`
  - Action: link to License or Billing depending on hosting mode.

Permissions:

- If import is not permitted, disable `Import` and show a tooltip explaining the missing permission.
- Read-only users may still search, change displayed columns, evaluate, and view details if read permissions allow those actions.

## Phase 2: Action Surfaces

After the table page is accepted, design each action surface as an overlay that preserves the current table page behind it. These overlays must not change the layout shell or Workspace tab frame.

### Import Action

Trigger: `Import`.

Surface:

- Centered modal.
- Width around `560px` on desktop.
- Full-width with margins on mobile.

Content:

- Title: `Import users`.
- Intro: `Choose a JSON data file to create or update global users.`
- Template link: `View template`.
- Notes:
  - `Users are created or updated by keyId.`
  - `New user properties are added without removing existing properties.`
- Drag-and-drop upload area with UploadCloud icon.
- Supported format: `JSON`.
- Maximum file size: `500 MB`.

Validation and states:

- Reject non-JSON files before upload.
- Reject files larger than 500 MB before upload.
- Uploading state disables close-sensitive actions and shows progress or spinner.
- Success toast: `User data has been successfully imported.`
- Error toast: `Failed to import user data. Please check the file and try again.`
- On success, close modal and invalidate the global users query.

### Evaluate Action

Trigger: row `Evaluate`.

Surface:

- Right drawer.
- Desktop width around `920px` to `960px`.
- Full-width drawer on narrow screens.
- The drawer should overlay the table with a subtle shadow and standard border. Avoid a harsh 50/50 split-screen feel.

Header:

- Primary: selected user's `name`.
- Secondary: selected user's `keyId`, with copy action when space allows.

Tabs:

- `Feature Flags`
- `Segments`

Feature Flags tab:

- Search input: `Filter by name or key`.
- Table columns: `Name`, `Key`, `Variation`, `Actions`.
- `Key` includes copy action.
- `Variation` uses a subtle colored marker and compact value badge.
- JSON and string variation values can be expanded into a read-only code modal.
- `Details` opens the flag targeting page in a new browser tab, matching Angular behavior.
- Use server-side pagination for flags.

Segments tab:

- Search input: `Filter by name`.
- Table columns: `Name`, `Type`, `Last updated`, `Actions`.
- `Details` opens the segment targeting page in a new browser tab, matching Angular behavior.
- Segment filtering can remain client-side if the API still returns all segments for a user.

### Details Action

Trigger: row `Details`.

Surface:

- Right drawer.
- Desktop width around `500px` to `540px`.
- Full-width drawer on narrow screens.
- The drawer should overlay the table with a subtle shadow and standard border. Avoid a harsh split-screen feel.

Content:

- Title: `User profile`.
- Section: `Built-in properties`.
- Rows: `keyId`, `name`.
- Section: `Custom properties`.
- Rows: all `customizedProperties`.
- Use definition-list rows with label and value.
- Add copy icon for long or identifier-like values.
- Empty custom properties render a quiet empty state.

## API And Data Notes

List endpoint:

```text
GET /api/v1/global-users
params:
  name: string
  pageIndex: number
  pageSize: number
```

Upload endpoint:

```text
POST /api/v1/global-users/upload
```

Data model:

```text
GlobalUser:
  id: string
  keyId: string
  name: string
  customizedProperties: Array<{ name: string; value: string }>
```

## Visual Direction

- Match the existing React Workspace tab style and density. The page should feel like a sibling of the current General, License, and Usage tab designs.
- Use neutral shadcn-style surfaces, subtle borders, and 6-8px radius.
- Keep the table compact, scannable, and operational.
- Use icons only where they clarify controls: Search, Display, Upload, Copy, ExternalLink.
- Keep color usage consistent with existing Workspace designs: FeatBit blue for primary actions and active states, green only for success/granted semantics, amber only where a warning or tier meaning exists, and muted gray for secondary information.
- Avoid hero sections, decorative illustrations, large colored bands, oversized typography, and layout chrome inside design images.
- Avoid hard vertical split compositions in action images; overlays should feel like modals/drawers on top of the same tab page.
- Do not copy Angular/ng-zorro table, modal, or drawer styling one-to-one.
- Dark mode should preserve the exact same layout with neutral dark surfaces, low-contrast borders, readable foreground text, muted secondary text, and restrained semantic accents.

## Acceptance Criteria For Later Implementation

- Global Users renders inside the existing Workspace tab frame without altering layout.
- Table page can be implemented from the Phase 1 design without needing action overlays.
- Search debounces, resets to page 1, and queries the backend by `name`.
- Table uses server-side pagination with page size options `10`, `20`, and `30`.
- Display dropdown discovers and toggles custom property columns.
- Import modal validates JSON format and 500 MB size before upload.
- Successful import closes the modal and refreshes the table.
- Evaluate drawer shows Feature Flags and Segments tabs with Angular-equivalent actions.
- Details drawer shows built-in and customized properties.
- Loading, empty, error, gated, and permission-disabled states are present.
- The tab works in `/en` and `/zh` routes and uses i18n keys for visible text.
