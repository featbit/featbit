# Relay Proxies Page Design

This document is the complete React design contract for the Relay Proxies experience: list, create, edit, view, environment selection, automatic/manual agent management, destructive confirmation, and the one-time key flow. Angular remains the functional reference for permissions, API behavior, validation, and agent operations, but the React experience must use the authenticated React visual language defined in [react-layout-design.md](react-layout-design.md), shadcn/ui, Base UI primitives, Tailwind tokens, and lucide-react.

## Design Asset

- Main page, light theme: [relay-proxies-list-light.png](relay-proxies-list-light.png)
- Edit relay proxy Sheet, light theme: [relay-proxies-edit-sheet-light.png](relay-proxies-edit-sheet-light.png)
- View relay proxy Sheet, light theme: [relay-proxies-view-sheet-light.png](relay-proxies-view-sheet-light.png)
- Choose environments Dialog, light theme: [relay-proxies-environment-dialog-light.png](relay-proxies-environment-dialog-light.png)

The images are visual baselines for hierarchy, density, spacing, and information grouping. They intentionally exclude the application sidebar and context bar. The Sheet images retain a dimmed portion of the main page only to communicate overlay continuity. Exact text, component behavior, permission handling, and responsive overflow follow this document rather than image-generation artifacts.

The written contract is normative for Create mode, manual-agent forms, confirmation states, and the one-time key Dialog even though those supporting states do not have separate image assets. Implementations must compose them from the same Sheet/Dialog primitives and tokens rather than inventing a new visual lane.

## Scope

This design covers the complete Relay Proxies workflow inside the existing authenticated shell.

- Keep the current sidebar and context bar unchanged and outside the design surface.
- Do not add page tabs, summary cards, charts, onboarding illustrations, status dashboards, or a second navigation layer.
- Create, Edit, and View use the same right-side Sheet structure with mode- and permission-aware controls. This document also covers the Choose environments Dialog, Add/Edit manual agent Dialog, removal confirmations, and one-time key Dialog.
- Preserve every Angular capability listed under **Functional invariants**, including behavior not expanded in the visual assets.

## Page Purpose

Relay Proxies is an organization-level administration surface for operators who configure which environments a proxy serves and manage the agents that synchronize configuration data. The page should let a user quickly answer three questions: which proxy is this, what does it serve, and how many agents are attached?

Use this page heading and supporting copy:

- Title: `Relay Proxies`
- Subtitle: `Connect Relay Proxy agents and control which environments they serve.`

The subtitle explains the operational purpose without repeating table labels or introducing deployment claims that the current data cannot prove.

## End-To-End Interaction Map

The list remains the stable home surface. Supporting work opens above it and returns to the same search and pagination context.

| Entry | Flow | Completion |
| --- | --- | --- |
| `New relay proxy` | Main list → Create Sheet → optional Choose environments / Add manual agent Dialogs → create request → one-time key Dialog | Copy key, close key Dialog, return to refreshed list |
| `Edit` | Main list → Edit Sheet → optional Choose environments / Add or Edit manual agent Dialogs → optional availability/sync operations → save request | Return to refreshed list with current filter retained |
| `View` | Main list → View Sheet → optional manual-agent availability check | Close and return to unchanged list |
| `Remove` | Main list → removal confirmation Dialog → delete request | Remove row, correct pagination if necessary, remain on list |

Nested surfaces follow a strict hierarchy:

1. Main list.
2. Create/Edit/View Sheet.
3. A single supporting Dialog above the Sheet.

Never stack two supporting Dialogs, open a second Sheet over the first, or navigate away for a small subtask. Closing a supporting Dialog returns focus to the control that opened it. Closing the Sheet returns focus to the originating row action or `New relay proxy` button.

## Permission Contract

| Permission state | Page and action behavior |
| --- | --- |
| No `ListRelayProxies` | Do not render the Relay Proxies page. Use the shared permission-denied route behavior and translated feedback. |
| `ListRelayProxies`, no `ManageRelayProxies` | Show list, search, pagination, masked data, and `View`. Hide New, Edit, Remove, save, scope mutation, automatic-agent removal, manual-agent Add/Edit/Sync/Remove. Keep manual-agent `Check availability`. |
| `ListRelayProxies` and `ManageRelayProxies` | Show the complete create, edit, remove, environment, and agent-management workflow. |

Do not show disabled upgrade-style controls for missing permission. Hide unavailable mutation actions while keeping readable data and legitimate read-only operations.

## Visual Direction

Use the React product's restrained, neutral workbench style.

- Use the normal `background` page surface and `foreground` text.
- Use `muted-foreground` for the subtitle, descriptions, masked keys, timestamps, and secondary scope text.
- Use one-pixel `border` dividers and no ambient card shadow.
- Use the standard dark-neutral primary button; do not bring Angular's green action styling into React.
- Use Inter Variable and the existing compact type scale: 24px page title, 14px body and labels, and 12px secondary metadata.
- Keep light and dark themes structurally identical and rely on semantic tokens rather than hard-coded light-theme colors.

The page should feel closest to the existing React Access Tokens and IAM Team list surfaces: a direct page header, compact toolbar, one bordered data surface, and pagination. It must not copy Angular/ng-zorro styling one-to-one.

## Main Page Layout

Use the established full-width React list-page shell with approximately `32px` horizontal page padding and `24px` top padding.

1. Page header with title and subtitle.
2. A single toolbar after a clear but compact vertical gap.
3. One full-width bordered table container.
4. Pagination and result count directly below the table.

Do not wrap the header, toolbar, or pagination in cards. Avoid excessive whitespace: the list should remain visible in the first desktop viewport when typical data is present.

## Toolbar

The toolbar has two ends and one row on desktop.

### Name search

- Place a `320px` search input on the left.
- Use a leading Search icon and placeholder `Filter by name`.
- Debounce changes by approximately `300ms`, reset the page index to `1`, and submit the trimmed name to the existing server-side filter.
- Keep the entered query visible during loading and error recovery.
- Do not add environment, agent-type, status, or sorting filters because Angular and the current API do not provide those list filters.

### Primary action

- Show `New relay proxy` with a leading Plus icon on the right only when the user has `ManageRelayProxies` permission.
- Use the normal shadcn primary button, not a custom green button.
- Opening the creation flow must preserve the list and current search behind the overlay.
- Users with list-only permission see no disabled or locked creation button; the toolbar simply keeps the search control.

## Table Design

Use TanStack Table with the shared shadcn `Table` primitives. The table has a thin outer border, a compact header, no row selection, no sorting controls, and no decorative shadows. Use a minimum desktop width around `980px`; if the content region becomes narrower, preserve columns through horizontal overflow rather than collapsing the page into cards.

### Column contract

| Column | Content and behavior | Suggested width |
| --- | --- | --- |
| `Relay proxy` | Name in medium/semibold text with the server-provided masked key below in compact monospace text. Never request or reconstruct the full key for this cell. | 19% |
| `Description` | Show the complete description as normal body text. Show `No description provided.` in muted text when empty. Allow long descriptions to wrap; do not move this content back into the identity column. | 19% |
| `Serves` | For all-environment proxies, show `All environments` and secondary text `All within the organization`. For custom scopes, show every selected environment path as a neutral outline badge. Let badges wrap across lines; never collapse them into `+N more`, a tooltip-only list, or another hidden count. | 27% |
| `Agents` | Show the automatic-agent and manual-agent counts as two compact neutral outline badges: `Auto N` and `Manual N`. Values come directly from `autoAgents.length` and `agents.length`; do not list agent names here or synthesize a health status that the list API does not define. | 13% |
| `Last updated` | Format `updatedAt` using the active locale while retaining date and time precision. Keep it on one line where practical. | 13% |
| `Actions` | Manage users see the two direct actions `Edit` and `Remove`. List-only users see `View`. Do not use an ellipsis or dropdown because the row has no additional secondary actions to group. | 9% minimum |

Keep Description as a dedicated column so users can scan operational purpose independently from proxy identity. The Relay proxy column groups only the name and masked key. Because all selected environments remain visible, row height may grow when scopes are numerous; this is preferable to hiding environment coverage behind a count.

### Row actions

- `Edit` opens the selected relay proxy in the existing edit flow.
- `View` opens the same information in read-only mode and must remain available to users who can list but cannot manage relay proxies.
- `Remove` is a direct destructive text/ghost action next to `Edit` and is present only when the user can manage relay proxies. Do not add a three-dot menu for this single secondary action.
- `Remove` opens a confirmation dialog. Copy should clearly state that removal cannot be reverted and name the relay proxy being removed.
- After successful removal, refresh or update the current page, decrement the total, and move to the preceding page if the removed item was the last row on a non-first page.
- Keep a row-level action disabled and show progress while its request is in flight; prevent duplicate submissions.

## Create, Edit, And View Detail Sheet

`New relay proxy`, `Edit`, and `View` use the same right-side shadcn `Sheet`. Keep the underlying list, search query, page index, and page size mounted behind a subtle overlay so closing the Sheet returns the user to the same place.

### Shared shell

- Use a full-height Sheet approximately `850px` wide on a desktop content area and constrain it to the viewport when space is smaller.
- Keep the Sheet independent from the application sidebar and context bar; do not resize or redesign either shell element.
- Use a bordered header, one vertically scrollable body, and an optional sticky footer.
- Header titles are `New relay proxy`, `Edit relay proxy`, and `View relay proxy`.
- Header subtitles are `Choose environments and configure connected agents.`, `Update its environments and manage connected agents.`, and `Review its environments and connected agents.` respectively.
- Keep the standard close action at the top right. Prevent closing while a save request is in flight.
- Preserve one information order in both modes: `General`, `Scopes`, `Auto agents`, then `Manual agents`.
- Separate sections with whitespace and one-pixel dividers. Do not introduce tabs, accordions, nested cards, or a summary sidebar.
- Do not display a relay proxy key field. The full key is unavailable after the creation-only copy flow, and the masked list value does not help with editing.

### Create mode

Create uses the same General, Scopes, Auto agents, and Manual agents sequence as Edit so users do not learn a second form.

- Start with empty Name and Description values.
- Default to `Custom environments` with no environments selected unless an existing product default is explicitly defined elsewhere. Show the required selection error only after the user attempts to create or leaves the invalid scope area.
- Auto agents always starts with `No automatic agents registered yet.` because automatic agents register only after a relay proxy and key exist.
- Manual agents can be added, edited, and removed from the local draft before creation.
- `Check availability` is available for a valid manual-agent URL.
- `Sync` remains disabled for every draft manual agent with the explanation `Sync is available after the relay proxy has been created.`
- The sticky primary action is `Create relay proxy`; while pending it becomes `Creating...`.
- A successful create must open the one-time key Dialog before the workflow is considered complete. Do not briefly expose the new full key in the Sheet or a toast.

### General section

Use a compact two-column layout when the Sheet has sufficient width.

- `Name` is required in Create and Edit. Edit uses the current value as its initial form value.
- Keep Angular's debounced duplicate-name check. Do not run a duplicate error against the unchanged original name.
- Show `Validating...`, `This name has been used`, or `Name validation failed` directly under the field when applicable.
- `Description` is optional and uses a short textarea in Edit with helper text `Describe the purpose of this relay proxy.`
- View renders the same two values in readable, neutral read-only surfaces. Remove the required marker, validation copy, resize affordance, and description helper rather than presenting disabled low-contrast controls.

### Scopes section

Start with helper text `Choose which environments this relay proxy can serve.` and retain the two existing choices:

- `Custom environments`
- `All environments`

In Edit:

- Use standard radio controls and keep the current selection visible.
- When `Custom environments` is selected, show `Choose environments` as an outline action aligned with the scope controls.
- Render every selected environment as a removable neutral chip containing its complete path name.
- Chips wrap across lines; never replace environments with `+N more` or a hidden-only list.
- Require at least one selected environment in custom mode and show `Select at least one environment.` close to the selection area.
- Show the compact warning `Scope changes require automatic agents to restart and manual agents to sync.` only after the saved scope value changes.

In View:

- Keep the saved radio selection understandable but non-interactive.
- Show every custom environment as a neutral chip without remove icons.
- Hide `Choose environments`, validation copy, and the scope-change warning.

### Choose environments Dialog

Clicking `Choose environments` opens a centered shadcn `Dialog` above the Edit Sheet. Keep the Sheet and main list mounted under a second subtle overlay so the user understands that environment selection is a temporary subtask of the current edit flow. Do not open another Sheet or replace the Relay Proxy form.

Use a desktop width around `640px` with a constrained body height and internal results scrolling.

#### Header and search

- Title: `Choose environments`.
- Subtitle: `Select the environments this relay proxy can serve.`
- Keep the standard close action at the top right.
- Use a full-width search input with a Search icon and placeholder `Search environments`.
- Debounce server search while keeping the current selection stable and visible.

#### Selected environments

- Show the heading `Selected environments` and an exact neutral count badge.
- Show `Clear all` on the right when at least one environment is selected.
- Render every selected environment in a distinct muted selected area as a removable chip containing its full `Project / Environment` path.
- Never collapse selected environments into `+N more` or mix them into filtered results.
- Removing a chip immediately updates the corresponding result row inside the Dialog's temporary selection state.

#### Available environments

- Use heading `Available environments` above one compact bordered, vertically scrollable result list.
- Group environments by Project. The group label is the project name; each row shows the environment name as primary text and its full `Project / Environment` path as muted secondary text.
- A selected row uses the standard neutral accent surface and a check icon. An unselected row uses the normal background and an unselected circular marker.
- Clicking a row toggles only that environment. Selection is multi-value.
- Search filters the available results but does not remove or hide selected chips from the selected area.
- Show compact skeleton rows while loading, `No environments found.` for a successful empty search, and a recoverable inline `Environments could not be loaded.` state with `Retry` on request failure.

#### Commit behavior

- Keep `Cancel` on the left and `Apply environments ({count})` as the right-aligned primary action.
- `Cancel`, the header close action, and Escape discard all temporary Dialog changes and return to the unchanged Edit Sheet.
- `Apply environments ({count})` replaces the Edit Sheet's current custom-environment selection with the Dialog snapshot and closes the Dialog.
- Disable Apply when zero environments are selected because custom scope requires at least one environment.
- The scope-change warning in the Edit Sheet is evaluated only after Apply and appears only when the applied environment IDs differ from the saved Relay Proxy scope.
- Applying environments does not save the Relay Proxy. The user must still use the parent Sheet's `Save changes` action.

### Auto agents section

Show the heading `Auto agents`, a neutral count badge, and helper text `Agents that register and synchronize automatically.`

Use one compact bordered table with these information groups:

| Group | Visible data |
| --- | --- |
| `Agent ID` | Agent identifier and `Registered` timestamp |
| `Serves` | Current reported serves value and `Reported` timestamp |
| `Sync status` | Sync state, `Last synced` timestamp, and `Data version` |
| `Action` | Edit mode only: `Remove` |

- Display the complete operational values returned in the automatic agent status payload; do not reduce them to a decorative healthy/unhealthy badge.
- In Edit, enable `Remove` only when the agent has been inactive for more than five minutes. Otherwise keep it visibly disabled with the explanation `Only agents that have been inactive for more than 5 minutes can be removed.`
- In View, omit the Action column entirely. Do not leave an empty column or disabled remove control.
- When there are no automatic agents, replace the table with compact text `No automatic agents registered yet.`

### Manual agents section

Show the heading `Manual agents`, a neutral count badge, and helper text `Agents that you add and synchronize manually.`

Use a compact bordered table or structured row with:

- Name and URL;
- served scope;
- last synchronized timestamp, including `Not synced yet` when absent;
- data version;
- direct permission-aware actions.

Edit mode shows `Add manual agent` at the section heading and direct row actions `Edit`, `Check availability`, `Sync`, and `Remove`. Do not place these actions in an ellipsis menu.

- `Check availability` and `Sync` each own an independent row-level loading state.
- `Sync` is enabled only for agents already saved on the current relay proxy. Keep it disabled for a newly added, unsaved agent and explain why in a tooltip.
- `Remove` requires confirmation before removing the agent from the pending form value.
- The Add/Edit manual-agent form retains required Name and valid URL fields and returns the user to this Sheet after confirmation.

View mode hides `Add manual agent`, `Edit`, `Sync`, and `Remove`. It retains `Check availability`, matching Angular's read-only behavior, and keeps the availability result in the standard success/error toast channel.

### Footer and submitting

- Create has a sticky footer with `Create relay proxy`; Edit uses `Save changes`.
- Do not add a redundant Cancel button; the standard close action exits the Sheet.
- Disable submission when required values are invalid or while name validation/saving is in progress.
- While submitting, use `Creating...` or `Saving...`, prevent duplicate submission, and keep the Sheet open if the request fails.
- On successful Edit, close the Sheet, show the translated success toast, and refresh the selected row/list while retaining the current list filter where possible.
- On successful Create, close the Sheet into the one-time key Dialog. Refresh the list after the key Dialog closes while retaining the current name filter where practical.
- View has no footer and no Save action. End with normal body padding after the Manual agents section.

### Mode comparison

| Capability | Create | Edit | View |
| --- | --- | --- | --- |
| Change name or description | Yes | Yes | No |
| Change all/custom environment scopes | Yes | Yes | No |
| Add or remove selected environments | Yes | Yes | No |
| Remove eligible automatic agent | Not applicable | Yes | No |
| Add/edit/remove manual agent | Yes | Yes | No |
| Check manual-agent availability | Yes | Yes | Yes |
| Sync a manual agent | No | Existing saved agents only | No |
| Submit changes | Create | Save | No |

Do not communicate View mode by lowering all content contrast. The absence of mutation affordances, non-interactive controls, and the `View relay proxy` title communicate the permission state while values remain easy to read.

## Supporting Dialogs

Supporting Dialogs use the standard centered shadcn Dialog, compact neutral styling, a bordered footer, and one clear primary outcome. They appear above the active Sheet or list and never alter the authenticated shell.

### Add and Edit manual agent

Use one Dialog approximately `480px` wide.

- Titles: `Add manual agent` and `Edit manual agent`.
- Subtitle: `Configure an agent that FeatBit can reach directly.`
- Required `Name` input.
- Required `URL` input with placeholder `https://my-manual-agent.com`.
- URL helper: `The URL of the agent that FeatBit can access.`
- Validate required Name and URL syntax locally. Show `Name is required.` or `Enter a valid URL.` directly below the relevant input.
- Keep `Cancel` as the secondary action and `Add agent` or `Save agent` as the primary action.
- Submission updates only the parent Sheet's local manual-agent draft; it does not call the Relay Proxy create/update endpoint and does not close the parent Sheet.
- Preserve the existing agent ID and operational metadata when editing. Generate the new draft ID using the established client behavior when adding.
- Do not place availability or sync requests inside this Dialog; those remain contextual row actions after the agent is added to the Sheet.

### Remove relay proxy confirmation

Use a destructive confirmation Dialog approximately `440px` wide.

- Title: `Remove relay proxy?`
- Body: `“{name}” will be permanently removed. This action cannot be undone.`
- Actions: `Cancel` and destructive `Remove relay proxy`.
- Do not require typing the name; the operation already has a single explicit target and confirmation boundary.
- While pending, use `Removing...`, disable both dismissal and repeated confirmation, and keep the Dialog open on failure.
- On success, close the Dialog, show a success toast, update the list count, and correct pagination when the current page becomes empty.

### Remove agent confirmations

Automatic- and manual-agent removal use a smaller confirmation Dialog or the shared confirmation primitive.

- Name the target agent in the confirmation copy when a readable name or ID exists.
- Confirming automatic-agent removal changes the parent Edit Sheet's pending `autoAgents` value; it is persisted only when the user saves the Sheet.
- Confirming manual-agent removal changes the parent Create/Edit Sheet's pending `agents` value; it is persisted only when the user submits the Sheet.
- Do not show a success toast for a local draft removal. The visible row disappearing is sufficient feedback.

### One-time relay proxy key

After a successful create, open a non-dismissible Dialog approximately `560px` wide.

- Title: `Relay Proxy key`.
- Use a compact information message: `Copy and save this key now. You won't be able to see it again after closing this dialog.`
- Show the complete key in a bordered monospace value surface with a dedicated `Copy key` action. Allow horizontal scrolling for an unexpectedly long value; never truncate the only available copy.
- Do not mask the key inside this one-time Dialog.
- Disable backdrop click, Escape, and the header close action. The user must use the footer completion action.
- Before a successful clipboard copy, show a disabled footer action `Copy the key to continue`.
- After copy succeeds, show the standard `Copied` toast, mark the key surface as copied with text/icon feedback, and enable the footer action `Done`.
- If clipboard access fails, keep the Dialog open, keep the key selectable for manual copy, and show `Copy failed. Select and copy the key manually.` Do not falsely mark the key as copied.
- `Done` clears the full key from client state, closes the Dialog, refreshes the list, and returns focus to the main page.
- The full key must not enter persistent browser storage, query caches beyond the creation handoff, logs, URLs, or the masked list model.

## Overlay, Focus, And Unsaved Changes

- Sheet transition follows the shared Base UI/shadcn timing; Dialogs use the shared short fade/scale transition. Do not add choreographed motion.
- Opening a Dialog traps focus inside it. Closing returns focus to its trigger inside the Sheet; closing the Sheet returns focus to the list action.
- Escape closes ordinary supporting Dialogs and the Sheet when no request is pending. Escape never closes the one-time key Dialog.
- When Create/Edit contains unsaved changes and the user closes the Sheet, show the shared discard confirmation with `Keep editing` and `Discard changes`. Do not prompt when the form is pristine.
- A pending request blocks dismissal of the surface that owns it but must not freeze unrelated read-only content visually.

## Pagination

- Keep server-side pagination and the existing page sizes `10`, `20`, and `30`.
- Show `Showing X to Y of Z relay proxies` on the left.
- Place the page-size select and previous/next or compact numbered pagination on the right, matching other React list pages.
- Reset to page `1` when the name query or page size changes.
- Disable unavailable navigation controls rather than hiding them.

## Functional Invariants

The migration must preserve the following Angular behavior. The main page provides the entry points, and the shared Create/Edit/View Sheet plus supporting Dialogs apply the detailed contracts above. Functional invariants remain binding even where this document does not supply a separate visual asset.

### List and permissions

- Guard page access with `ListRelayProxies`.
- Load a server-paginated list filtered by name.
- Preserve name, description, masked key, all-environment/custom scopes, resolved environment path names, automatic agents, manual agents, and update timestamp.
- Branch actions using `ManageRelayProxies`: manage users can create, edit, and remove; list-only users can view.
- Show translated success and failure feedback for create, update, remove, agent availability, and agent synchronization requests.

### Create, edit, and view flows

- Preserve required name validation, asynchronous duplicate-name validation, unknown validation failure, and unchanged-name behavior when editing.
- Preserve optional description.
- Require either `All environments` or at least one selected custom environment.
- Preserve organization-level environment selection and selected environment removal.
- When scopes change during edit, explain that automatic agents require restart while manual agents require manual sync.
- Preserve read-only viewing without exposing save or mutation controls.
- Refresh the list after a successful create or update without discarding the user's name filter unnecessarily.

### Automatic agents

- Preserve agent ID, served scope/status payload, registered time, reported time, synchronization state, last synchronized time, and data version.
- Preserve the empty state when no automatic agent has registered.
- An automatic agent can be removed only after it has been inactive for more than five minutes.
- Keep the unavailable remove action disabled and explain the five-minute rule in a tooltip.

### Manual agents

- Preserve add and edit using required Name and valid URL fields.
- Preserve name, host, created time, served scope, last synchronized time, and data version.
- Preserve availability checks for both manage and read-only users.
- Preserve manual synchronization for existing saved agents only; newly added unsaved agents cannot synchronize.
- Preserve separate loading states for availability and synchronization operations.
- Preserve removal from the pending edit form behind confirmation.

### One-time relay proxy key

- After successful creation, show the full relay proxy key once in a non-dismissible key dialog.
- Explain that the key cannot be viewed again after the dialog closes.
- Require the user to copy the key successfully before enabling the close/confirmation action.
- The main list must display only the masked key returned by the list API. It must never reveal, infer, cache, or copy the full creation key later.

## States

Every surface keeps its stable structure while data or mutations are pending.

| Surface | Loading | Empty | Error | Pending mutation |
| --- | --- | --- | --- | --- |
| Main list | Five skeleton rows | Initial or filtered empty state | Inline retry message | Only the affected row action is disabled |
| Create Sheet | Not applicable | Auto/manual sections use their empty copy | Validation remains inline; request failure uses toast and keeps values | Primary action shows `Creating...`; dismissal blocked |
| Edit/View Sheet | Section skeletons while selected proxy data is prepared, if list data is insufficient | Agent sections use their own empty copy | Keep readable loaded sections; failed operational requests use toast | Save or affected agent action owns its loading state |
| Choose environments Dialog | Compact result skeletons | `No environments found.` | Inline retry state | Apply is synchronous to parent draft; no server mutation |
| Manual agent Dialog | Not applicable | Not applicable | Field validation remains inline | Add/Save updates parent draft immediately |
| One-time key Dialog | Not applicable | A missing returned key is an unrecoverable creation-response error and must not show an empty success Dialog | Copy failure keeps key selectable and Dialog open | Done remains disabled until copy succeeds |

### Loading

Keep the title and toolbar stable. Render five compact skeleton rows inside the existing table shell so the page does not jump. Do not replace the table with a centered spinner.

### Initial empty state

Inside the table body, show:

- Title: `No relay proxies yet`
- Supporting text: `Create a relay proxy to connect agents and choose which environments they serve.`
- `New relay proxy` outline action only when the user can manage relay proxies.

List-only users receive the text without a misleading action.

### Filtered empty state

Show `No relay proxies match “{query}”.` with a `Clear search` outline action. Do not reuse the initial empty-state copy.

### Load error

Keep the toolbar and render a compact destructive-tinted message above or inside the table boundary with `Relay proxies could not be loaded.` and a `Retry` outline action. Retrying preserves the current query, page, and page size.

### Mutation feedback

Use Sonner success/error toasts consistent with the React app. Keep errors recoverable and leave the relevant overlay open when create, update, availability, or sync operations fail.

## Internationalization And Content

- Put all user-visible strings in a Relay Proxies feature resource and provide English and Chinese values.
- Preserve the route language prefix.
- Use plural-aware result-count copy.
- Allow environment paths, descriptions, and translated labels to truncate only where the full value remains available through a tooltip or popover.
- Keep API values such as proxy keys, agent IDs, hosts, and data versions unmodified except for server-provided masking and presentation formatting.

## Accessibility

- Associate the search label through its visible placeholder/accessibility name and preserve the standard focus ring.
- Provide accessible names for pagination icons and any remaining icon-only controls.
- Keep row actions keyboard reachable and destructive confirmation keyboard operable.
- Associate every Sheet/Dialog field label and validation message with its control and set invalid state when validation fails.
- Environment result rows must expose selected state to the selection primitive and remain operable by keyboard; retain check icons and the selected summary so color is never the only cue.
- Give removable environment chips explicit names such as `Remove Payments / Production`.
- Announce exact selection count changes and clipboard success through the existing component/toast behavior without adding persistent duplicate messages.
- Maintain focus containment and restoration across list → Sheet → Dialog transitions, including after Apply, Cancel, and destructive confirmation.
- Do not rely on color alone for disabled, destructive, loading, or selected state.
- Maintain WCAG AA contrast; move muted text toward `foreground` when shown on tinted surfaces.

## Acceptance Criteria

- Only the Relay Proxies workflow surfaces are redesigned; the sidebar and context bar remain unchanged.
- The page follows the existing React title, toolbar, table, and pagination rhythm.
- Search, server pagination, create, edit, view, remove, permissions, environment scopes, both agent types, availability checks, manual sync, and the one-time key flow remain functionally available.
- The default table shows proxy identity, description, masked key, served environments, automatic/manual agent counts, update time, and permission-aware actions without adding unsupported status semantics.
- Full relay proxy keys appear only in the copy-once creation dialog.
- Edit and View share the same General, Scopes, Auto agents, and Manual agents hierarchy; View removes mutation affordances without reducing content readability.
- Choose environments opens a centered multi-select Dialog, keeps every selected path visible, groups results by Project, and commits changes to the parent Sheet only through Apply.
- Create reuses the detail Sheet, permits draft manual agents, prevents pre-create sync, and always hands a successful response into the copy-once key Dialog.
- Manual-agent Add/Edit, relay-proxy removal, agent removal, unsaved-change confirmation, and one-time key completion have explicit Dialog contracts and submission boundaries.
- Permission behavior matches the documented matrix: list-only users retain View and availability checks without seeing mutation controls.
- Default, loading, initial-empty, filtered-empty, error, read-only, and mutation states are specified.
- Light and dark themes use semantic shadcn tokens, and English and Chinese routes show translated content.
