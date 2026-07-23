# Segments Details Page Design

## Scope

This document defines the React redesign of the Segment details workflow in `front-end-v2`.

Included:

- the Segment summary header;
- the `Targeting`, `Settings`, and `History` tabs;
- included and excluded user selection;
- targeting-rule creation, editing, removal, and ordering;
- change review and required change comments;
- Segment name, description, tags, key, type, and scope disclosure;
- Feature Flag references;
- permission, loading, empty, dirty, saving, and error states.

Excluded:

- the Segments index workflow, which remains defined by `segments-page-design.md`;
- changes to the authenticated sidebar;
- changes to the organization/project/environment context bar;
- mobile-first layout work.

The Angular page is the functional reference only. The React page must use the compact, neutral shadcn/Base UI and Tailwind patterns established in `front-end-v2`; it must not reproduce the Angular/ng-zorro visual structure.

## Design Asset

![Segments details Targeting light design](segments-details-targeting-light.png)

![Segments details Targeting with many users](segments-details-targeting-many-users-light.png)

![Segments details Targeting review light design](segments-details-targeting-review-light.png)

![Segments details Settings light design](segments-details-settings-light.png)

![Segments details Settings review light design](segments-details-settings-review-light.png)

![Segments details History light design](segments-details-history-light.png)

The first image defines the accepted default `Targeting` hierarchy and desktop density. The second defines the accepted bounded-list treatment when Included or Excluded contains many users. The third defines the accepted Targeting review Dialog with its History-aligned muted change surface, semantic grouping, and vertical condition diffs. The fourth defines the accepted `Settings` form hierarchy and dirty state. The fifth defines the accepted Settings review Dialog with its History-aligned muted change surface and vertical scalar diffs. The sixth defines the accepted `History` activity-list hierarchy, muted change surface, and compact default treatment for high-cardinality user changes. Sample Segment, user, tag, scope, and rule values are illustrative; implementation must render API data.

## Finalized Design Direction

Use the selected **Focused workbench** direction:

- keep Segment identity and operational context in one compact header;
- use route-backed line tabs for `Targeting`, `Settings`, and `History`;
- place included and excluded users side by side at normal desktop widths;
- give rules the full content width so conditions remain readable;
- keep save state visible near the tab content without turning the page into a dashboard;
- use thin borders and quiet tonal surfaces, not nested cards or ambient shadows;
- let History chronology come from localized date headings, a fixed `HH:mm` column, indentation, and whitespace rather than timeline decoration or event separators;
- keep the page information-dense but preserve 32-36px interactive controls and clear section spacing.

The page starts inside the existing main content area. Do not draw, replace, or restyle the sidebar or context bar.

## Information Architecture

Content order:

1. Back link to `Segments`.
2. Segment summary header.
3. `Targeting`, `Settings`, and `History` tabs.
4. Active-tab content.

The Angular implementation renders editable settings above its tabs. React separates those responsibilities: identity and frequently needed metadata remain visible in the summary header, while editable descriptive fields move into the `Settings` tab. This reduces repeated vertical weight on the main targeting workflow without removing functionality.

Routes should preserve the existing localized route prefix and use explicit detail-tab paths:

- `/segments/:id/targeting`;
- `/segments/:id/settings`;
- `/segments/:id/history`.

Opening a Segment from the index page continues to navigate to `targeting`. An unknown or omitted tab resolves to `targeting` rather than rendering an empty page.

## Segment Summary Header

Use the same compact detail-header rhythm as current React IAM detail pages.

### Back link

Show an Arrow Left icon and `Segments`. It returns to the index route and should preserve any index state already retained by the router/query layer.

### Primary row

- Render the Segment name as the page title.
- Keep the title to one line and truncate only when necessary.
- The Feature Flag reference affordance sits at the far right of the title row and is vertically centered with the title.
- Show the shorter pluralized link `{count} feature flag reference(s)` when references exist, for example `3 feature flag references`.
- Use quiet link color without a permanent underline; show the underline on hover/focus.
- Show `No feature flag references` as muted, non-interactive text when the count is zero.

### Metadata row

Use one compact, single-baseline metadata row beneath the title:

- For a Shareable Segment, combine type and scope count into one semantic group: plain text `Shareable`, a muted middle dot, then the clickable `3 scopes` value with a small Chevron Down. Do not use a `Type` or `Scopes` label, Badge, border, or filled background for this group.
- For a Current-environment Segment, show only the plain text `Current environment`; do not render a scope count or chevron.
- Show a small muted inline `Key` label followed on the same baseline by a compact monospace surface and Copy icon.
- Show a small muted inline `Tags` label followed on the same baseline by quiet neutral filled chips. Show a compact subset followed by `+N` when necessary.
- Separate the semantic groups with approximately 24px of whitespace. Do not add vertical separators or a containing metadata card.

The key copy action copies the complete value and shows `Copied`. Truncated keys and tags must remain recoverable through a tooltip.

The Shareable scope count is a lightweight Popover trigger:

- clicking `3 scopes` or its chevron opens the Popover;
- the chevron points upward while expanded;
- group the complete scope list by project;
- use the same project and environment icons established by onboarding and the Segments scope picker;
- show complete scope names and use a tooltip only when a value still requires truncation;
- keep the Popover read-only; Segment scopes are not edited from the details page;
- use an internally scrolling list when the scope list exceeds the Popover's maximum height.

The header is a summary, not an editing surface. Name, description, and tags are edited under `Settings`.

## Tab Navigation

Use shadcn line tabs on a single bottom border, matching current React detail pages.

- `Targeting` is the default tab.
- `Settings` contains descriptive and classification fields.
- `History` contains Segment audit records.
- Tab selection is represented in the URL so refresh, deep links, and browser navigation behave predictably.
- Switching tabs with unsaved changes must ask the user to discard or remain on the current tab. Do not silently lose a targeting or settings draft.

Do not place counts in the three tab labels. Counts belong near the content they describe.

## Targeting Tab

### Command row

Place a compact command row immediately below the tabs.

- When the draft equals the last loaded Segment, omit `Unsaved changes` and disable `Review & save`.
- When anything changes, show `Unsaved changes` and enable the primary `Review & save` button.
- While saving, disable editing and show the standard pending state on the primary action.
- On success, update the local/server cache, clear the dirty state, and show the shared success toast.
- On failure, retain the complete draft and show a recoverable error message.

The button opens change review; it does not save directly.

### Targeting users

Use one section titled `Targeting users`, followed by two equal-width bordered panels:

- `Included users`;
- `Excluded users`.

Each panel contains:

- a heading with the complete selected-user count rendered as small ordinary muted text, not a Badge;
- a compact `Search or add users` combobox;
- one selected user per row, with display name, secondary key, and Remove action; do not show an avatar or user icon, and do not place two users on the same row;
- an inline empty state when no users are selected.

Keep each panel at a stable bounded height when many users are selected:

- keep the panel heading and search field fixed;
- show approximately four to five complete compact rows before scrolling;
- scroll only the selected-user list inside the panel;
- show a subtle native/customized scrollbar when content overflows;
- let Included and Excluded lists scroll independently so one collection cannot increase the other panel's height;
- use list virtualization for very large collections without changing the visible interaction model;
- do not collapse selected users into a `+N more` summary or paginate the panel.

The combobox query searches both selected and available users. Matching selected users appear first with a visible `Selected` state and remain removable; available results follow and remain addable. This lets users locate an existing member without adding a second filter control.

Results must support the Angular search behavior and user creation capability. A user already selected in either collection must not be duplicated in the same collection. If the same user moves between included and excluded, resolve the conflict explicitly rather than allowing contradictory targeting.

For Shareable Segments:

- search and selection use global users only;
- creation of environment-local users is unavailable;
- selected global users remain visible even when they cannot be found in a later result page;
- the UI explains the global-user restriction beside the chooser, not in a large banner.

At narrower desktop widths, stack the two panels. Do not optimize a separate phone layout.

### Rules

Rules use the full content width beneath Targeting users.

The section header contains:

- title `Rules`;
- an outline `Add rule` button aligned right;
- a compact permission explanation when rule editing is unavailable.

Each rule is one flat bordered block with:

- drag handle;
- editable rule name;
- overflow menu containing `Remove rule`;
- ordered condition rows;
- `Add condition` as a lightweight action.

`Add rule` appends the new rule to the end of the ordered rule list, preserving the Angular behavior and the position of existing rules. After insertion, scroll the new rule into view and move focus to its name field so the result of the action is immediately visible. Do not prepend a new rule or shift the existing rules downward.

Each condition retains the Angular model and supported behavior:

- user property selection, including adding a property when supported;
- operator selection appropriate to the property/value type;
- one or more values where the operator requires them;
- condition removal;
- validation before review or save.

Use inline 32-36px controls. Attribute, operator, and value receive progressively more width. Do not use vertical separators between fields. Keep `AND` visible between multiple conditions so the match logic is understandable without extra prose.

Rules are reorderable by their handle only. Reordering marks the draft dirty. Keyboard and pointer interactions use the chosen drag-and-drop primitive's native focus and announcement behavior.

When there are no rules, show a compact inline empty state with `Add rule`; do not add illustration art or a large empty card.

### Match explanation

At the bottom of the editor, show muted copy:

`Users matching any rule are included unless explicitly excluded.`

This copy clarifies precedence without adding another configuration control.

## Review And Save Dialog

`Review & save` opens a centered shadcn Dialog, approximately 700-740px wide, that preserves the Angular targeting change-review workflow while replacing its generic diff presentation with a readable domain summary.

Header:

- title `Review targeting changes`;
- description `Review the pending changes to {segmentName} before saving.`;
- standard Close action, disabled while saving.

### Targeting change list

Show one heading row with `Changes` on the left and ordinary muted `{count} changes` text on the right. The count represents the complete deterministic set of atomic change instructions and is not a Badge.

Put Targeting users and Rules on one continuous neutral surface equivalent to the History `bg-muted/60` treatment:

- use the current React semantic `muted` token so the surface adapts to light and dark themes;
- use `rounded-md`, approximately 14-16px padding, no border, no shadow, and no horizontal separators;
- use typography, indentation, and 18-24px vertical whitespace instead of section or rule dividers;
- do not create independent cards or nested backgrounds for groups, users, rules, or conditions;
- keep the Dialog header, Changes heading, Change comment, and footer outside this surface.

Targeting users:

- show `Targeting users` as a normal medium-weight group heading;
- render `Included users` and `Excluded users` as separate aligned rows beneath it;
- use three columns for collection label, neutral operation/count, and affected identities;
- within each collection, render Added and Removed as separate rows and include the affected count, for example `Added · 2`;
- render affected users as plain inline identities that wrap within the value column. Do not use avatars, chips, status Badges, or colored operation text;
- prefer display name, then email, then key, and expose the complete stable key through a Tooltip when the visible identity is not the key;
- preserve every affected identity in deterministic diff order inside the bounded Changes surface; do not summarize or silently truncate a high-cardinality collection;
- omit unchanged collections and empty Added/Removed subrows.

Rules:

- separate Rules from Targeting users with approximately 22-24px of whitespace, not a divider, and show `Rules` as a normal medium-weight group heading;
- give each changed rule a compact header containing its medium-weight name and neutral operation label;
- separate changed rules with approximately 18-20px of whitespace and no nested rule card;
- added rule: show `Added` and its complete readable condition summary beneath the header;
- removed rule: show `Removed` and its complete previous condition summary beneath the header;
- renamed rule: show the old muted name, a neutral down arrow on its own compact line, and the new foreground name;
- edited condition: show the complete previous muted attribute/operator/value expression, a neutral down arrow on its own compact line, and the complete new foreground expression;
- added or removed condition: label the operation and show the complete expression;
- reordered rule: show `Moved from position {before} to {after}`;
- use neutral text treatments for Added, Removed, Updated, and Moved; do not rely on green/red status colors.

The complete muted Changes surface has `max-height: 360px` and `overflow-y: auto` when content exceeds that height. It is the only inner vertical scrollbar in the Dialog. Use `scrollbar-gutter: stable` and `overscroll-behavior: contain`; keep the surface keyboard focusable and label it from the visible Changes heading and count. Do not show raw JSON, endpoint names, IAM permission names, technical IDs, or request payloads.

### Targeting diff completeness requirement

The implementation must produce a complete semantic diff from the full saved targeting model and the full current draft. The design image is illustrative only; it is not an allowed implementation fixture or the complete set of supported operations. Do not implement the Review Dialog by recognizing only the example users, rule names, attributes, operators, or values shown in the image.

The diff implementation and automated tests must cover at least:

- no changes and structurally equivalent drafts;
- one or many users added to or removed from Included users;
- one or many users added to or removed from Excluded users;
- a user moved between Included and Excluded in the same draft without reporting contradictory duplicate operations;
- users that have no display name, cannot be resolved by the current user result page, or are represented only by a key;
- duplicate or repeated user keys in malformed input without producing duplicate review rows;
- one or many rules added or removed;
- rule rename, reorder, condition edits, and deletion/addition occurring together in one rule;
- multiple rules changed in the same draft, including rules with identical names;
- rule matching by stable rule identity rather than display name or array position;
- a rule moved while its name or conditions also change;
- zero, one, or many conditions in a rule;
- condition addition, removal, attribute change, operator change, value change, and combinations of those changes;
- empty, null-like, boolean, numeric, date/time, string, and multi-value operands supported by the rule model;
- values containing long text, Unicode, punctuation, duplicate-looking labels, or values that require wrapping;
- multi-value additions and removals without treating a semantically irrelevant ordering change as a value replacement, unless value order is meaningful for that operator;
- complete readable formatting for every supported targeting operator, including operators that accept no value;
- deterministic display order and a stable atomic `Changes` count across repeated renders of the same before/after data;
- large diffs that require bounded scrolling without dropping, truncating beyond recovery, or silently collapsing operations;
- permission or data refresh occurring while the Review Dialog is open;
- failed save followed by retry without recomputing against a partially mutated saved baseline.

Diff calculation must be pure: it must not mutate the saved Segment, current draft, rule order, condition arrays, or user collections. Every operation shown in Review must be derivable from the exact payload that will be submitted, and every submitted targeting change must have a readable representation in Review. If an unknown future operator or value type cannot be formatted semantically, show a safe structured fallback rather than omitting the change.

### Targeting change comment

Use the current environment's `Require change comment` setting (`requireChangeComment`) as the only source of required state:

- when enabled, show a required marker, require a non-empty trimmed comment, and disable submission while invalid;
- when not enabled, show `(optional)` inline with `Change comment` and allow an empty value;
- use placeholder `Describe why this change is needed`;
- show helper text `Used for auditing and change tracking.`

The Targeting review design image shows the optional state. Do not infer required state from the type or number of targeting changes.

### Targeting submission

The footer contains outline `Cancel` and primary `Save changes`, without a tinted footer background. Closing or canceling returns to the intact draft.

Saving submits included keys, excluded keys, the complete ordered rules collection, and the normalized optional/required comment through the single existing targeting endpoint. Targeting save is therefore one request, unlike the independently submitted Settings operations:

- disable the Dialog and editor actions while the request is pending;
- on success, update the saved baseline/cache, close the Dialog, clear dirty state, and show success feedback;
- on failure, keep the Dialog open, preserve the entire draft and comment, show one recoverable inline error, and allow `Save changes` to retry;
- do not display Settings-style partial-success results for Targeting.

## Feature Flag References Dialog

Clicking the header reference link opens the same reference-dialog pattern used by the Segments index archive flow.

- Title: `Feature flag references`.
- Description names the current Segment in bold.
- Render one compact bordered list; rows should not become tall cards.
- Each row shows Feature Flag name and key.
- A reference in the current environment is clickable and opens that flag's targeting page.
- A cross-environment reference remains visible but is disabled and labeled `Not in this environment`.
- If references become empty between load and open, show the inline empty state.

## Settings Tab

Settings uses one left-aligned focused form column, approximately 720-780px wide. Do not center the form or stretch its controls across the full main-content width. Use whitespace rather than section dividers or independent cards.

The persistent Segment summary header remains the authoritative read-only surface for:

- Key and its Copy action;
- Current-environment or Shareable type;
- the Shareable scope count and scope Popover;
- the last successfully saved tags.

Do not repeat Key, Type, or Scopes as disabled fields in the Settings body. Their Angular functionality remains available in the persistent header while the Settings form stays focused on editable values. The header continues to show last-saved values while a draft is dirty and updates only after the relevant save operation succeeds.

### Command row

Use the same compact command row immediately below the tabs:

- when the form is clean, omit `Unsaved changes` and disable or omit `Discard` and `Review & save` according to the shared detail-page action pattern;
- when any permitted field differs from its last-saved value, show `Unsaved changes`, an outline `Discard` button, and the primary `Review & save` button;
- `Discard` resets every Settings draft field to the last confirmed server value without affecting Targeting;
- `Review & save` validates the form and opens the Settings change-review Dialog; it does not submit directly;
- while mutations are pending, disable form controls and both actions and show the standard pending state on the primary action.

### General

Use normal labeled form controls instead of Angular's inline pencil, cancel, and save icons.

Fields:

- `Name`: required, trimmed, standard-height text input, editable only with `UpdateSegmentName`; helper text is `A human-friendly name for this segment.`;
- `Description`: optional compact multiline textarea, editable only with `UpdateSegmentDescription`; show `(optional)` inline with the label rather than as placeholder text.

Keep approximately 16px between each label/control/helper group. Do not add character counts or limits unless the backend contract defines them. Preserve the separate name and description backend updates and their independent permission checks. Review submits only fields that actually changed.

### Tags

Separate Tags from General with approximately 36-40px of clean vertical whitespace and a normal section heading. Do not render a horizontal rule, border, background band, or card between the sections. Show helper copy `Use tags to organize and filter segments.`

Provide one combined searchable multi-value field that:

- loads existing workspace/environment tag suggestions;
- excludes already-selected values from results;
- allows creation when no matching tag exists;
- supports removing pending tags;
- renders selected tags as quiet removable neutral chips inside the field;
- uses the placeholder `Search or create tag` after the selected chips;
- shows `Press Enter to create a new tag.` as helper text;
- keeps changes local until review and save;
- respects `UpdateSegmentTags` independently of name and description permissions.

The field grows vertically only when selected tags wrap; do not render a separate selected-tag card above it. Selected tags use the shared neutral Badge/combobox treatment. Do not use tag color as operational status.

### Settings save behavior

When multiple settings fields are edited, the review Dialog lists each pending operation. Because the backend preserves separate name, description, and tag endpoints, implementation may submit them sequentially or as coordinated mutations, but must:

- retain unsaved values if any operation fails;
- identify the failed field;
- refresh the Segment summary only from confirmed saved data;
- include the required change comment with every operation that requires it.

The review summary must distinguish `Name`, `Description`, and `Tags` changes and omit unchanged operations. Canceling review returns to the intact draft. A successful save clears the dirty state and leaves the user on the Settings tab.

### Settings review Dialog

Use a centered shadcn Dialog, approximately 640-680px wide.

Header:

- title `Review settings changes`;
- description `Review the pending changes to {segmentName} before saving.`;
- standard Close button, disabled while saving.

The `Changes` heading row shows `Changes` on the left and ordinary muted `{count} changes` text on the right. Do not use a count Badge.

Put the complete field-level diff on one neutral tonal surface equivalent to the History `bg-muted/60` treatment:

- use the current React semantic `muted` token so the surface adapts to light and dark themes;
- use `rounded-md`, approximately 12-16px padding, no border, no shadow, and no horizontal separators between fields;
- use one continuous surface rather than a card per field;
- use a stable two-column grid with an approximately 100-112px field-label column and a flexible value column;
- separate field groups with approximately 16-20px of whitespace;
- keep endpoint names, IAM action names, JSON, and request payloads out of the UI.

Render only dirty fields that the user is currently permitted to update:

- `Name`: show the old muted value, a neutral down arrow on its own compact line, then the new foreground value. Do not switch to a horizontal arrow for short names; Name and Description use the same vertical reading direction.
- `Description`: show the old muted value, a neutral down arrow on its own compact line, then the new foreground value so long text remains readable.
- `Tags`: show separate `Added` and `Removed` subrows with quiet neutral chips; omit either subrow when empty. Added and Removed are neutral non-interactive labels, not colored statuses or links.

#### High-cardinality Tags review

Large Added and Removed tag collections use compact previews and local disclosure without creating independent cards or independent scrollbars.

- When an Added or Removed collection contains three or fewer tags, show every chip and omit its disclosure action.
- When a collection contains more than three tags, show the first three in stable diff order, include the total with the operation label such as `Added · 12`, and show a text button `Show {remaining} more`.
- Added and Removed expand independently. Expanding one does not expand the other and changes only its control to `Show less`.
- Keep the preview chips in the summary subrow and reveal only the remaining chips beneath it.
- Let expanded chips wrap naturally within the value column. Do not add avatars, another background, a nested card, a horizontal divider, or a Badge representing the remaining count.
- Long tag values truncate only when necessary and expose the complete value through a Tooltip.
- The entire Changes muted surface, not each tag collection, has `max-height: 320px` and `overflow-y: auto` when expanded content exceeds that height. This is the only inner vertical scrollbar in the Dialog.
- Use `scrollbar-gutter: stable` and `overscroll-behavior: contain` so disclosure does not shift the grid or unexpectedly scroll the page behind the Dialog.
- Keep the Dialog header, `Changes` heading, Change comment, and footer outside the Changes scroll region so they remain reachable.
- Tag disclosure triggers use `aria-expanded` and `aria-controls`, retain focus after expansion/collapse, and remain outside any clipped chip content.

Below the Changes surface, show one `Change comment` textarea:

- read the current environment's `Require change comment` setting (`requireChangeComment`) as the only source of whether the field is mandatory;
- when `Require change comment` is enabled, show a required marker, require a non-empty trimmed value, and disable submission while invalid;
- when `Require change comment` is not enabled, show `(optional)` inline with the label, allow an empty value, and do not show required validation;
- use placeholder `Describe why this change is needed`;
- show helper text `Used for auditing and change tracking.`;
- pass the same normalized comment to every dirty operation that is submitted.

The Settings review design image shows the optional state where `Require change comment` is not enabled. Do not infer required state from the number or type of pending operations.

The footer has outline `Cancel` and primary `Save changes`. It has no tinted background or decorative divider. Disable `Save changes` when the required comment is invalid or while requests are pending.

The single action is a UI-level change set, not an atomic backend transaction. Name, Description, and Tags remain independently authorized and independently submitted:

- call only endpoints for dirty, permitted fields;
- record each result separately, using `allSettled` or equivalent coordination;
- update the header/cache and saved baseline for each successful field;
- retain the draft and dirty state only for failed fields;
- never show a generic all-success message after partial success.

If any operation fails, keep the Dialog open and replace the change presentation with per-field results, for example `Saved`, `Failed`, or `Permission is no longer available`. The footer becomes `Close` and primary `Retry failed`. Retrying calls only the remaining failed operations and retains the existing comment. If permissions changed while the Dialog was open, reload permission state and prevent further edits to the denied field.

## History Tab

History is a read-only audit activity list. It does not use the Targeting or Settings Review Dialog layout. Keep the persistent Segment summary header visible so the audited resource remains unambiguous.

### History query contract

- Always filter by Segment reference type and the current Segment ID.
- For a Shareable Segment, set `crossEnvironment=true` exactly as Angular does so records from every shared scope are included.
- For a Current-environment Segment, keep history environment-scoped and do not show a cross-scope indicator.
- Load the newest records first, using the existing audit-log page size of 10 unless the shared API contract changes.
- Preserve the API total count and append later pages through `Load more`; do not replace the loaded records when loading the next page.

### History toolbar

Use one compact toolbar row directly above the activity list:

- search input with Search icon and placeholder `Filter by name or comment`;
- searchable team-member Combobox with default label `All team members`;
- date-range Popover with Calendar icon and default label `Any date`;
- for a Shareable Segment only, right-aligned muted text `Across {count} scopes` with an Info tooltip explaining that history includes every shared scope.

The embedded Segment History does not show the global Audit Logs `Filter by type` control because both reference type and reference ID are fixed by the page.

Debounce the text query by 400ms. Search team members server-side with the existing 500ms debounce. Changing query, creator, or date range resets the audit-log page index to the first page and replaces the previously accumulated result set. Clearing a filter restores the unfiltered Segment history.

#### Searchable member filter

Use the established React `Popover + Command` creator-filter pattern rather than a non-searchable Select:

- The trigger uses `role="combobox"`, exposes expanded state, and shows `All team members` when no member is selected.
- When selected, show the member's display name, then email, then ID as the trigger-label fallback. Truncate the visible trigger label without losing the full identity from the open result.
- Opening the Popover reveals a `CommandInput` with placeholder `Search team members by name or email`.
- Send the debounced search value to the existing server-side team-member query. Do not rely on filtering only the currently loaded page in the browser.
- Result rows show display name and a smaller email when both exist; fall back safely to email or ID. Do not add avatars.
- Mark the selected result with the standard Check icon and close the Popover after selection.
- Show a compact loading state while searching, `No team members found` for a successful empty result, and a recoverable inline error with `Retry` when the query fails.
- When a member is active, expose a separately labelled Clear action without requiring the user to reopen the Popover.
- Clearing the filter returns the trigger to `All team members`, resets History pagination, and reloads the unfiltered creator result.
- Preserve the search query while the Popover remains open; clearing or closing behavior must follow the existing shared creator-filter convention.

#### Date range filter

The date control is a true inclusive start/end range filter, not a single-date picker:

- The closed trigger shows a Calendar icon and `Any date` when empty.
- When active, format the localized range as `{start date} – {end date}`. Use a compact date format in the trigger and expose the complete localized range through its accessible name and Tooltip if the visible value truncates.
- Open a Popover containing the official shadcn Calendar configured for range selection. Show two months side by side at normal desktop widths and one month when constrained.
- Keep the current applied range as the initial draft whenever the Popover opens.
- Selecting only a start date shows `Select an end date` and keeps `Apply` disabled.
- The Popover footer contains quiet `Clear` and outline `Cancel` actions plus primary `Apply`. It has no tinted background or decorative top divider.
- `Cancel`, outside click, or Escape closes the Popover without changing the applied filter.
- `Apply` commits only a complete start/end range, closes the Popover, resets History pagination, and issues one refreshed query. Do not refresh once for the start date and again for the end date.
- `Clear` removes both endpoints, closes the Popover, resets the trigger to `Any date`, and reloads unfiltered dates.
- Treat both selected calendar days as inclusive in the user's display timezone and convert them through the shared API date helper so records on the end date are not accidentally excluded.
- Prevent or normalize an end date earlier than the start date through the range-selection primitive; do not show an impossible range.
- During implementation, if Calendar is still absent from `front-end-v2/src/components/ui`, add it from the official shadcn source/CLI for the current setup and do not hand-edit the generated primitive.

### Activity list

Use a flat chronological stream on the page background. Do not render a bordered outer list, an event card, a table, an Angular-style timeline rail, timeline dots, horizontal separators between events, avatars, or a second outer card.

- Group records by localized calendar date and show the date as a normal semibold heading.
- Within each date, order records newest first.
- Under a date heading, use a fixed narrow time column and a flexible event-content column.
- Render time as localized `HH:mm` only, right-aligned in muted text. The date heading already carries the calendar date, so do not repeat a full timestamp inside every event.
- Align every event narrative and change surface to the same content-column start.
- Separate events with approximately 20-24px of vertical whitespace and date groups with approximately 28-32px. Do not reintroduce horizontal rules to replace the removed timeline.
- The narrative leads with the actor identity, readable operation, and Segment name. Show actor email when no display name exists; when both exist, use the compact `email (name)` treatment shown in the asset.
- Place the optional change comment directly beneath the narrative as muted body text.
- Supported operation copy covers Create, Update, Archive, Restore, Remove, and any future operation returned by the API through a safe readable fallback.
- Do not use green/red operation colors. Destructive history is historical information, not a destructive action.
- A navigable Segment name may open the Segment Targeting route for non-Remove records. Remove records must not expose a broken destination.

### Visible change details

Render field-level change instructions by default beneath the event comment. Do not require an event-level `View changes` disclosure and do not make the user open every audit record to understand it.

- Put only the concrete field-level diff on one neutral tonal surface equivalent to `bg-muted/60`; keep the narrative and comment on the page background.
- Use the current React semantic `muted` token rather than a hard-coded blue-gray, lavender, or warm tint. The surface must adapt to light and dark themes.
- Use the shared medium radius (`rounded-md`), approximately 10-12px vertical padding and 12-16px horizontal padding, no border, and no shadow.
- Give all event diff surfaces the same content width and left/right alignment, using a full-width block capped around `max-w-3xl`.
- Do not create nested background cards for individual fields, users, rules, or instructions.
- Render Added, Removed, Updated, and Moved as neutral non-interactive text. Only genuine navigation and disclosure controls use link styling.
- Preserve the audit record's complete instruction list with History-specific compact rows for users, rules, conditions, name, description, tags, and every other Segment instruction returned by the API.
- Description and other before/after scalar values use a clear vertical old-to-new reading order inside the same surface.
- Long values wrap when practical or truncate only with a recoverable Tooltip; no instruction or value may disappear beyond recovery.
- Events with no field-level instructions omit the muted surface instead of rendering an empty container.

### High-cardinality Included and Excluded users

Included and Excluded are separate change rows inside the same event diff surface. Do not turn them into side-by-side comparison panels, nested cards, avatar lists, Badge collections, or comma-separated unbounded text.

Default collapsed row:

- Use aligned columns for collection label, neutral operation/count, compact user preview, and disclosure action.
- Copy follows `{collection} | {operation} · {total} | {preview users} | Show {remaining} more`, for example `Included users | Added · 18 | Aisha Khan, Daniel Smith | Show 16 more`.
- When the collection contains one or two users, show all names and omit the disclosure action.
- When it contains more than two users, show the first two names in stable API order and omit email addresses from the collapsed preview.
- Truncate an unusually long preview only when necessary and provide a Tooltip containing the complete previewed identities.
- `Show {remaining} more` is a text button, not a Badge or bordered button.

Expanded row:

- Expanding Included affects only Included; expanding Excluded affects only Excluded. Both may be open independently.
- Keep the first two preview names in the summary row and reveal only the remaining users beneath it.
- Align the expanded collection with the preview/value column rather than the left edge of the entire diff surface.
- Show a compact two-column user grid at normal desktop widths and one column when constrained.
- Each expanded user shows a medium-weight display name and a smaller muted email or unique identifier beneath it. Do not show avatars.
- Do not add another background, border, divider, or card around the expanded collection.
- Limit each expanded Included or Excluded collection to `max-height: 240px`; use `overflow-y: auto` only when content exceeds that height.
- Use `scrollbar-gutter: stable` so the content does not shift when the vertical scrollbar appears, and `overscroll-behavior: contain` so reaching the collection boundary does not unexpectedly scroll the page.
- Keep `Show less` in the summary row outside the scroll container so it remains visible.
- The scrollable region must be keyboard focusable and have an accessible name identifying the collection and operation.
- The trigger uses `aria-expanded` and `aria-controls`; expanding or collapsing retains focus on the trigger.

### High-cardinality Rules changes

Rules use the same progressive-disclosure principle without hiding the existence of rule changes.

- Label the group `Rules · {count} changes`.
- When there are three or fewer rule changes, show every rule and omit disclosure controls.
- When there are more than three changes, show the first two in stable API order and a text button `Show {remaining} more`.
- The collapsed rule row exposes at least the rule name and neutral operation so the audit record remains understandable without expansion.
- Expanding Rules reveals the remaining rules inline within the same event diff surface and changes the control to `Show less`.
- Each expanded rule shows its name and operation; condition-level attribute, operator, and before/after value changes appear beneath it with compact indentation.
- Limit expanded Rules content to `max-height: 320px`; use an independent vertical scrollbar beyond that height, with stable scrollbar gutter and contained overscroll behavior.
- Rules, Included users, and Excluded users expand and scroll independently.
- Do not add an event-level accordion around these local disclosures and do not silently omit rule or condition instructions.

### History instruction completeness requirement

The History renderer must be driven by the complete audit instruction payload, not by the fields and sample values visible in the design asset. Implementation and automated tests must cover at least:

- one or many users added to or removed from Included users;
- one or many users added to or removed from Excluded users;
- Included and Excluded changes occurring together, including a user moving between the two collections;
- users with display name and email, display name only, email/key only, duplicate-looking names, long Unicode identities, and unresolved identities;
- counts at, below, and above the collapsed-preview threshold;
- expanded user collections below and above the 240px scrolling threshold;
- name and description creation, replacement, clearing, long wrapping values, and null-like values;
- one or many tags added and removed in the same event;
- rules added, removed, renamed, reordered, or edited;
- condition addition, removal, attribute/operator/value replacement, multi-value changes, and rules with zero conditions;
- Rules collections at, below, and above the disclosure threshold and 320px scrolling threshold;
- events containing several instruction categories at once without changing their API order or dropping a category;
- Create, Update, Archive, Restore, Remove, events with no instructions, and unknown future operations or instruction types.

Use a safe readable structured fallback for an unknown instruction rather than hiding it or rendering raw unbounded JSON. Counts, collapsed previews, disclosure labels, and expanded collections must remain deterministic across repeated renders of the same record.

### History pagination

Center one outline `Load more` button below the activity stream while `loaded < total`. A pending state on `Load more` must not replace or dim records already loaded.

Hide `Load more` when all records are loaded. Do not use numbered pagination for this embedded history workflow.

### History states

- Initial loading uses toolbar and activity-row skeletons; keep the header and History tab visible.
- Filter changes keep the toolbar interactive and replace the list with compact loading rows.
- Initial empty state: `No history yet` with concise text explaining that future Segment changes appear here.
- Filtered empty state: `No changes match these filters` with `Clear filters`.
- Load failure keeps current filters and shows a compact error row with `Retry`.
- Failure while loading more preserves existing records and retries only the failed next page.

## Permissions And Read-Only Behavior

Evaluate permissions independently for each capability:

| Area | Permission | Denied behavior |
| --- | --- | --- |
| Included/excluded users | `UpdateSegmentTargetingUsers` | Keep data visible; disable chooser and removal controls; show the shared permission explanation. |
| Rules | `UpdateSegmentRules` | Keep rules readable; disable add, edit, delete, and drag controls. |
| Name | `UpdateSegmentName` | Render the current value in a disabled/read-only field. |
| Description | `UpdateSegmentDescription` | Render the current value in a disabled/read-only field. |
| Tags | `UpdateSegmentTags` | Keep tags visible; disable add and remove. |

Do not hide saved data because the user cannot edit it. Do not show a page-wide permission banner when only one subsection is restricted. The review/save action considers only operations the user is allowed to perform.

If a capability is unavailable because of licensing, use the shared license explanation near the affected control. Persisted Shareable Segment data remains visible even if the current license no longer grants new Shareable edits.

## States

### Initial loading

Show skeletons matching the final geometry:

- back link and header metadata;
- tab line;
- two user panels;
- two rule blocks or the active tab's equivalent content.

Avoid a full-page spinner that removes context.

### Load failure

Keep the back link visible. Replace the header/content with one compact destructive-toned error row containing `Segment could not be loaded` and `Retry`.

### Missing Segment

Use the shared not-found treatment and a return action to Segments. Do not render an empty editor.

### Empty targeting

Show compact, actionable empty states inside Included users, Excluded users, and Rules. The page remains structurally stable.

### Dirty navigation

Intercept tab changes, back navigation, and route changes while a draft is dirty. Use a confirmation Dialog with `Keep editing` and destructive/secondary `Discard changes` actions. Browser refresh protection may use the standard browser prompt.

### Validation

Do not show errors before a field is interacted with or the user requests review. Focus the first invalid targeting condition or settings field after failed validation.

## Internationalization And Content

- Add all details-page strings to the centralized Segments feature resources under `front-end-v2/src/lib/i18n/resources` during implementation.
- Register resources through the existing global i18n composition; do not register a bundle from the page component.
- Provide English and Simplified Chinese values together.
- Use `Shareable` in English and `共享` in Chinese.
- Parameterize Segment names, Feature Flag counts, scope counts, user counts, and operation summaries.
- Localize History date/time formatting, `{count} changes`, `{count} users`, `Show {remaining} more`, `Show less`, and the accessible names for Included, Excluded, and Rules scroll regions.
- Localize the member-search placeholder/empty/error states, `Any date`, the applied date-range label, `Select an end date`, `Clear`, `Cancel`, and `Apply`.
- Localize the Settings Review `{count} changes`, Added/Removed tag counts, `Show {remaining} more`, `Show less`, and the accessible name for the bounded Changes region.
- Localize the Targeting Review `{count} changes`, Targeting users/Rules headings, Included/Excluded operation counts, rule operations, move summaries, and the accessible name for its bounded Changes region.
- Treat Added, Removed, Updated, Moved, and operation summaries as complete localized messages rather than concatenating translated fragments around a number or resource name.
- Do not assemble translated sentences from fragments.

## Accessibility And Interaction

- Use semantic headings and route-backed Tabs.
- Keep visible labels for user collections, rule names, fields, and Dialogs.
- Entire user result rows and permitted rule controls receive pointer cursors.
- Icon-only actions require accessible names and tooltips where their meaning is not visible.
- Use the standard shadcn focus ring; keep focus visible on complete clickable rows and drag handles.
- History high-cardinality disclosures use native buttons with `aria-expanded` and `aria-controls`; the corresponding bounded scroll regions are keyboard focusable and have collection-specific accessible names.
- Expanding or collapsing a History user/rule collection retains focus on its trigger and never moves focus into the scroll region automatically.
- Interactive `Show N more`/`Show less` text must remain visually distinguishable from neutral Added, Removed, Updated, and Moved audit labels.
- Settings Review tag disclosures use native buttons with `aria-expanded` and `aria-controls`; expanding or collapsing Added/Removed tags retains focus on the trigger.
- When the Settings Review Changes surface becomes scrollable, make it keyboard focusable and label it from the visible `Changes` heading and count.
- When the Targeting Review Changes surface becomes scrollable, make it keyboard focusable, label it from the visible Changes heading/count, and keep comment and footer actions outside the scrolling region.
- The History member filter follows Combobox keyboard semantics, exposes its expanded state, announces loading/empty/error results, and provides an independently labelled Clear action.
- The History date trigger exposes the complete applied range in its accessible name. Range Calendar days, draft range, disabled Apply state, and footer actions remain fully keyboard operable.
- Color is never the only indicator of active, invalid, dirty, disabled, or permission-denied state.
- Maintain WCAG AA contrast in light and dark themes.

## Responsive Desktop Behavior

- Design target: desktop main-content widths from approximately 1024px upward.
- At wide widths, Included and Excluded users are equal columns and rules span both.
- Below the space needed for two usable user panels, stack them without changing their order.
- Metadata and command rows may wrap, but the primary action remains easy to locate.
- Condition rows may wrap their value control below attribute/operator on constrained desktop widths.
- History keeps its date heading above a fixed `HH:mm` column and flexible event column; on constrained widths, the time remains a short leading column rather than becoming a repeated full timestamp.
- Expanded History user collections use two columns when space allows and one column when constrained; the 240px maximum height and vertical-scroll behavior remain unchanged.
- History diff rows may wrap their preview and action without changing the order label, operation/count, value, then disclosure.
- Settings Review keeps its field-label/value grid at the accepted Dialog width. If the Dialog is constrained, place the field label above its value without changing the old-arrow-new reading order.
- Tags wrap inside the Settings Review value column; the Changes surface remains capped at 320px and scrolls independently while comment and footer actions remain visible.
- Targeting Review keeps its three-column user rows at the accepted Dialog width. When constrained, operation/count stays with the collection label and identities wrap beneath without changing their semantic order.
- Targeting Review rule expressions remain vertical old-arrow-new; its Changes surface stays capped at 360px and scrolls independently while comment and footer actions remain visible.
- Do not introduce a separate mobile navigation or phone-specific details experience.

## Functional Invariants

The React migration must preserve:

- loading the Segment and its Feature Flag references by ID;
- copying the complete Segment key;
- displaying Current-environment and Shareable Segment metadata and scopes;
- editing name, description, and tags through their existing contracts;
- searching, selecting, creating where allowed, including, and excluding users;
- restricting Shareable Segments to global-user selection;
- adding, renaming, deleting, and reordering rules;
- adding, editing, and removing rule conditions and values;
- reviewing before/after targeting changes;
- optional and required change comments;
- independent permission checks for targeting users, rules, name, description, and tags;
- opening current-environment Feature Flag references while disclosing inaccessible cross-environment references;
- Segment audit logs filtered by reference type and ID;
- cross-environment History for Shareable Segments;
- complete History instruction rendering with bounded, independently expandable high-cardinality user and rule collections;
- loading, success, error, empty, validation, and dirty-navigation feedback.

## Acceptance Criteria

- Only the Segment details main content and its supporting Dialogs/popovers are designed; sidebar and context bar remain unchanged.
- `Targeting`, `Settings`, and `History` are distinct route-backed tabs, with `Targeting` as default.
- The compact header exposes Segment identity, type, key, scopes, tags, and Feature Flag references without duplicating the old Angular settings block.
- Included and Excluded users are side by side at normal desktop widths and remain independently operable.
- Rules are full-width, compact, reorderable, and expose every Angular condition operation.
- Targeting Review produces a complete, deterministic, non-mutating semantic diff for every supported user, rule, condition, operator, value, and combined-change edge case listed in the Targeting diff completeness requirement; automated tests cover the full matrix rather than only the design-image examples.
- Targeting Review uses one borderless semantic muted Changes surface, plain user identities with neutral operation counts, whitespace-based Targeting users/Rules grouping, vertical condition diffs, and one bounded 360px scrollbar without dropping any atomic change.
- Unsaved changes are explicit and saving always passes through review/change-comment behavior.
- Settings preserves independent name, description, and tags permissions and backend operations.
- Settings Review uses one borderless semantic muted Changes surface, renders Name and Description with the same vertical old-to-new pattern, and keeps non-interactive Added/Removed labels neutral.
- Settings Review shows at most three Added/Removed tag chips by default; larger collections expand independently inside the single bounded 320px Changes scroll region without hiding any tag.
- History preserves Segment filtering, member/date/text filters, Shareable cross-environment behavior, localized date grouping, fixed `HH:mm` indentation, complete visible instructions, and incremental centered `Load more` pagination without adopting either Review Dialog design.
- The History member filter performs debounced server-side name/email search with loading, empty, error, selected, and clear states; it is not a non-searchable Select.
- The History date filter selects an inclusive start/end range, keeps selection as a local draft until Apply, formats the applied range in the trigger, and clears both endpoints together.
- History uses no timeline rail, timeline dots, event cards, outer bordered list, or horizontal event separators; hierarchy comes from date headings, the time column, alignment, and whitespace.
- Field-level History diffs use the React semantic muted surface with uniform width, medium radius, no border, and no shadow; non-interactive operation labels do not look like links.
- Included and Excluded History changes show at most two preview names by default, expand independently to bounded 240px two-column user lists with vertical scrolling, and keep `Show less` outside the scroll region.
- Rules History changes remain visible when small; large groups show two changes by default and expand independently inside a bounded 320px vertically scrollable region without dropping condition-level details.
- Permission or license denial disables mutation without hiding persisted data.
- The design uses current React/shadcn hierarchy, has no ambient card shadows, and does not copy Angular/ng-zorro styling.
- No React or Angular implementation file is changed as part of this design-only task.
