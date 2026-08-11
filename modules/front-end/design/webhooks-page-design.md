# Webhooks Page, View/Edit, Live Debug, and View Logs Design

This document is the React design contract for the Webhooks main page, Webhook View/Edit Sheet, Live Debug Dialog, and View Logs Sheet. Angular remains the functional reference for data, filters, pagination, form behavior, test-payload generation, request behavior, persisted delivery logs, and action flows, but the React experience must use the authenticated React visual language defined in [react-layout-design.md](react-layout-design.md), shadcn/ui, Base UI primitives, Tailwind tokens, and lucide-react.

## Design Asset

- Main page, light theme: [webhooks-list-light.png](webhooks-list-light.png)
- Webhook View Sheet, light theme: [webhooks-view-light.png](webhooks-view-light.png)
- Webhook Edit Sheet, light theme: [webhooks-edit-light.png](webhooks-edit-light.png)
- Expanded payload-template editor, light theme: [webhooks-template-expanded-light.png](webhooks-template-expanded-light.png)
- Live Debug success result, light theme: [webhooks-live-debug-success-light.png](webhooks-live-debug-success-light.png)
- View Logs with expanded request detail, light theme: [webhooks-view-logs-light.png](webhooks-view-logs-light.png)

The images are visual baselines for hierarchy, density, spacing, and realistic content. They intentionally exclude the application sidebar and context bar. The View and Edit images show the same webhook and preserve section order across modes; the Live Debug image shows the successful-result state above the dimmed main page; the View Logs image shows the newest persisted delivery expanded inside the right-side Sheet. This written contract is normative for behavior, exact component semantics, canonical event values, dynamic content, dark theme, and edge states; example names, URLs, dates, payloads, and counts in the images are not fixed product copy.

## Scope

This design covers the Webhooks main content page, its Webhook View/Edit Sheet, Live Debug Dialog, and View Logs Sheet inside the existing authenticated shell.

- Keep the current sidebar and context bar unchanged and outside the design surface.
- Do not add page tabs, summary cards, charts, onboarding illustrations, delivery metrics, or a second navigation layer.
- The View/Edit Sheet is visually specified here. The New Webhook workflow reuses the Edit structure with create-mode defaults; the removal confirmation remains behaviorally specified without a separate visual asset.
- Do not modify Angular behavior, API contracts, backend validation, permissions, license behavior, or routing as part of this design task.

## Accepted Design Decisions

This section is the implementation and review index for the decisions confirmed during design iteration. Detailed component behavior and edge cases remain normative in the corresponding sections below.

| Area | Accepted decision |
| --- | --- |
| Main-page filters | Show only Name search and Project. Do not add an Environment filter. |
| Main table | Use `Status`, not `Delivery`, as the combined configuration/delivery column label. |
| Scopes column | Display every environment scope directly. Never collapse Scopes to `+N`. |
| Events column | One readable event plus an exact `+N` remains acceptable because the complete canonical event list is accessible. |
| Row actions | Keep `Edit` visible beside `Live debug`; More contains only `View logs` and `Remove`. |
| Webhook name | Opens the Webhook Sheet in View mode; it does not silently enter Edit mode. |
| View/Edit | Reuse one right-side Sheet and identical General, Scopes, Events, Request, and Security section order. |
| Edit Scopes | Reuse the Relay Proxy Environment Picker workflow. Select environments directly; Project is only a grouping/serialization attribute, not a separate input. |
| Live Debug | Use one centered Dialog for a real test request. Unsaved-form tests remain local and never submit the parent Sheet or become delivery history. |
| View Logs | Use a right-side Sheet titled `Delivery logs for {webhookName}` with no explanatory subtitle. |
| Log time scope | Show `Past 15 days` as read-only toolbar metadata, not a date-range control. |
| Payload editor | Use CodeMirror 6, not Monaco. Embedded height is approximately `240px`. |
| Editor enlargement | Provide one action, `Expand editor`. It opens the same editor draft in a full-viewport workspace; do not also provide `Enter full screen` or drag resize. |
| Expanded editor save | Do not add Save/Apply/Cancel inside the expanded editor. Exit returns to the unchanged Sheet, whose `Save changes` remains authoritative. |
| Application shell | Sidebar and context bar are outside the design and remain unchanged. |

## Page Purpose

Webhooks is an organization-level integration surface for operators who send feature flag and segment changes to external systems. The page should let a user quickly answer four questions: which hooks exist, where they deliver, what they observe, and whether recent delivery is healthy.

Use this page heading and supporting copy:

- Title: `Webhooks`
- Subtitle: `Send feature flag and segment events to external services.`

The subtitle is direct and describes existing behavior without claiming reliability or monitoring capabilities the current API does not provide.

## Visual Direction

Use the React product's restrained, neutral workbench style.

- Use the normal `background` page surface and `foreground` text.
- Use `muted-foreground` for the subtitle, creator, relative delivery time, inactive state, and secondary metadata.
- Use one-pixel `border` dividers and no ambient card shadow.
- Use the standard dark-neutral primary button; do not carry Angular's green action styling into React.
- Reserve green and red for delivery semantics, not decoration. Inactive and never-triggered states remain neutral.
- Use Inter Variable and the existing compact type scale: 24px page title, 14px body and labels, and 12px secondary metadata.
- Keep light and dark themes structurally identical and use semantic tokens rather than hard-coded light-theme colors.

The page should feel continuous with the current React Access Tokens and Relay Proxies list surfaces: direct page header, compact toolbar, one bordered data surface, and concise pagination. Angular/ng-zorro is a functional reference, not a visual template.

## Main Page Layout

Use the established full-width React list-page shell with approximately `32px` horizontal padding and `24px` top padding.

1. Page header with title and subtitle.
2. One toolbar after a compact vertical gap.
3. One full-width bordered table container.
4. Result count and pagination in the table footer or immediately below the table.

Do not wrap the header or toolbar in cards. Typical rows should remain visible in the first desktop viewport. The design is desktop-first; horizontal overflow is preferable to hiding operational data in a narrow viewport.

## Toolbar

The toolbar uses one row on desktop, with filters on the left and the primary action on the right.

### Name search

- Use a `320px` search input with a leading Search icon and placeholder `Filter by name`.
- Debounce changes by approximately `300ms`, trim the submitted value, reset the page index to `1`, and use the existing server-side name filter.
- Keep the entered value visible while the list reloads or recovers from an error.

### Project filter

- Use a searchable Select with placeholder `Project` when no project is selected.
- Populate it from the existing organization project list.
- Allow clearing the selection.
- Selecting or clearing a project resets the page index to `1`, then reloads the server-side list.
- Loading the project list must not block name search, pagination, or an already-rendered webhook list.
- Every implementation Select must use `SelectContent > SelectGroup > SelectItem`; do not render `SelectItem` directly under `SelectContent`.
- Do not add an environment filter to the main-page toolbar. Environment coverage remains visible in the `Scopes` column and editable through the Add/Edit workflow.

### Primary action

- Place `New webhook` on the far right with a leading Plus icon.
- Use the default primary Button at the established compact height.
- Activating it opens the Add Webhook workflow; it does not navigate away from the list.
- Do not add an inline enable switch, bulk action, export, refresh, or advanced-filter button. Angular and the current API do not expose those main-page operations.

## Table

Use a single bordered table with a subtle `muted/40` header, compact rows, and no ambient shadow. Preserve server order, which is newest-created first.

### Column model

| Column | Content and behavior |
| --- | --- |
| `Webhook` | Primary name plus secondary `Created by {name or email}`. The name is the edit affordance and opens the Edit Webhook workflow. Truncate only at constrained widths and expose the full name in a tooltip. |
| `Status` | First line shows `Active` or `Inactive`. Second line shows the last delivery result and time, or `Never triggered`. The whole data area is the View Logs affordance. |
| `Endpoint` | URL in compact monospace styling, single-line ellipsis, with the complete URL in a tooltip. Do not expose the secret or request headers here. |
| `Scopes` | Show every environment scope as an outline chip. Wrap chips within the cell when needed; never replace scopes with `+N` or hide them behind a summary popover. |
| `Events` | Translate the first selected event into a concise human-readable label and show `+N` for the remainder. The full view lists every canonical event value in a bounded, scrollable popover or tooltip. |
| Actions | Show `Edit` followed by `Live debug` as visible compact ghost/outline actions. A More button opens the row menu containing only `View logs` and `Remove`. |

Do not split `Active` and last delivery into separate table columns. Their relationship is more useful as one two-line operational cell and leaves adequate width for URL, scope, and event content.

### Status semantics

- Active state uses a small green dot plus `Active`; inactive uses a neutral dot plus `Inactive`.
- A successful last delivery uses a green CheckCircle icon and the HTTP response code when present.
- A failed last delivery uses a red CircleAlert or XCircle icon and the invalid response code when present; use `ERROR` if no response code exists.
- Time uses localized compact relative text in the row, such as `8 min ago`. The tooltip includes the localized absolute date/time and the complete Angular-equivalent success or failure explanation.
- `Never triggered` uses neutral styling. Do not present it as an error.
- The Status cell is clickable even when the hook is inactive or has never triggered, because the deliveries surface may still contain earlier records.

Color never carries delivery meaning alone: retain icon shape, text, and response value.

### Scope and event summaries

- Use chips only as compact data summaries, not as decorative badges.
- Show every scope chip directly in the cell and use compact wrapping when a webhook monitors several environments.
- Scope rows may become taller to preserve complete information. Keep padding compact and align other cells to the row's vertical center.
- Never use `+N`, a tooltip-only list, or a popover as a substitute for visible scope names.
- Scope content comes from `scopeNames`; do not reconstruct names from scope IDs when the API provides display names.
- A single unusually long scope name may truncate within its chip only when necessary for table width; expose that individual complete name in a tooltip.
- Event summaries continue to use one visible event plus an exact `+N`, with all event values available on hover/focus or activation.
- Event summary labels may be translated for scanning, but the expanded view must preserve exact event identity.

### Row actions

- `Live debug` opens Send Test Event for the selected saved webhook.
- The webhook name opens the Webhook Sheet in View mode.
- `Edit` is a visible row action placed before `Live debug`; it opens the same Webhook Sheet directly in Edit mode.
- `View logs` remains in the More menu and opens the same View Logs Sheet as the Status cell.
- `Remove` is destructive, appears last, and opens a confirmation before the delete request.
- Row menus open on click, not hover. Closing a menu returns focus to its More button.
- Do not make the entire row clickable; URL, tooltip, debug, menu, and delivery targets need distinct predictable affordances.

## Pagination

Preserve server-side pagination.

- Default page size: `10`.
- Page-size options: `10`, `20`, and `30`.
- Show `Showing {start} to {end} of {total} webhooks` on the left.
- Place the page-size Select and previous/current/next controls on the right.
- Changing page size resets the page index to `1` and reloads.
- Changing any filter resets the page index to `1`.
- After removing the final item on a non-first page, move to the previous valid page before or while refreshing.
- Disable unavailable previous and next controls rather than hiding them.

## Webhook View and Edit Sheet

Use one right-side Sheet for reading and editing a webhook. View and Edit are modes of the same information architecture, not separate routes or unrelated layouts. Keeping identical section order makes the transition predictable and prevents users from re-learning the form.

### Entry and frame

- Clicking the webhook name opens View mode. The visible row `Edit` action opens Edit mode directly.
- Use a right-side shadcn `Sheet` approximately `850px` wide with `max-width: calc(100vw - 48px)` and full available height.
- Keep the Webhooks page mounted beneath one neutral overlay. Preserve filters, pagination, loaded rows, and scroll position.
- Use a compact sticky header, independently scrolling body, and—only in Edit mode—a sticky footer.
- Sheet sections always appear in this order: General, Scopes, Events, Request, Security.
- Use a continuous white/`background` surface with one-pixel section dividers. Do not put each section in a Card.
- Use the standard close X. Backdrop click does not close the Sheet; Escape and X may close it when no save or test request is pending.

### View mode

- Title is the webhook name, for example `Production deploy notifications`. Keep it on one line; truncate only the dynamic name when necessary and expose the complete name in a tooltip.
- Place an outline active/inactive status Badge beside the title. Status meaning uses text and icon/tone rather than color alone.
- Header actions are outline `Live debug`, primary `Edit`, then the standard close X. Do not add View Logs or Remove here.
- Render values as read-only text, chips, a compact table, and code—not disabled form controls. View mode should look intentionally readable, not like an unavailable form.
- General shows Endpoint and creator. Endpoint uses compact monospace, supports copy, and exposes its complete value when truncated.
- Scopes groups selected environments by project and shows every environment; never replace environments with `+N`.
- Events groups selected events under Feature flag and Segment. Show readable translated labels and preserve each canonical event value in muted monospace or an accessible detail.
- Request shows custom headers, payload-template type, payload template, and Prevent Empty Payloads state.
- Mask the value of every custom header by default because arbitrary headers may contain credentials. Provide a keyboard-accessible reveal/hide control per value; copying a value must not require revealing it visually.
- Payload template uses the shared read-only CodeMirror surface. `Default` and `Custom` are plain type metadata in View mode, not a selectable control. View mode provides the same single `Expand editor` action for inspecting the complete template.
- Security masks the webhook secret by default with explicit reveal/hide and Copy actions. Do not put the secret or a revealed header value into a tooltip, DOM title, analytics event, or toast.
- View mode has no footer. Closing restores focus to the webhook name that opened it; choosing Edit retains the same body scroll position when practical.

### Edit mode header and footer

- Title is `Edit {webhookName}`, for example `Edit Production deploy notifications`. Apply the same one-line truncation rule to the name segment.
- Do not place a subtitle or explanatory text beneath the title.
- The sticky footer places outline `Live debug` on the left and `Cancel` plus primary `Save changes` on the right.
- `Live debug` is enabled only when the current draft is valid and opens the shared Dialog using unsaved form values. It never submits or saves the Sheet.
- During save, change the primary action to `Saving…`, disable duplicate submission and Sheet dismissal, but keep form content visible.
- Cancel, X, or Escape closes immediately when pristine. If the draft is dirty, open a confirmation Dialog with `Discard changes` and `Keep editing`; never discard silently.

### General fields

- Use required Name and Endpoint inputs plus an Active Switch. Keep Name and Endpoint on one responsive two-column row when space permits; stack them below the narrow breakpoint.
- Name keeps Angular's required, debounced asynchronous case-insensitive duplicate validation, validating feedback, and unknown-validation failure. When editing, the current saved name remains valid.
- Endpoint is required and uses the existing absolute HTTP/HTTPS URL validation. Invalid copy: `Enter a valid absolute HTTP or HTTPS URL.`
- Active defaults from the saved webhook and remains configuration state; changing it does not imply a delivery result.

### Scopes editor

- Reuse the same Environment Picker pattern and component behavior as the React Relay Proxy Sheet. Do not ask the user to select a project separately.
- The Sheet shows one bordered selection summary with `{count} environments selected`, a `Choose environments` button, and every selected environment as a removable secondary Badge using its full path name such as `Checkout / Production`.
- Badges wrap inside the selection summary and never collapse to `+N`. Each badge exposes the environment RN in the same tooltip behavior as Relay Proxy.
- `Choose environments` opens the shared centered Environment Picker Dialog. It includes the current selected-environment summary, Clear action, name/path/RN search, and the available environment list grouped under project headings.
- Each environment row shows its environment name and RN with a Checkbox; project headings organize scanning but are not selectable values.
- Dialog selection is a local draft. `Apply ({count})` updates the Webhook Sheet and closes the Dialog; Cancel/X closes it without changing the Sheet draft.
- Unlike Relay Proxy, Webhooks do not expose an `All environments` scope mode because the existing Webhook payload has no equivalent `isAllEnvs` semantic. Reuse only the selected-environment picker workflow.
- Require at least one selected environment. Keep the error beneath the selection summary and disable Dialog Apply when its draft is empty, matching the shared picker behavior.
- Removing the last selected Badge leaves the empty summary and validation state; it does not create a project row or close the Sheet.
- When saving, group the selected environment resources by their project IDs and serialize them into the existing `${projectId}/${envIds.join(',')}` scope strings. The UI simplification must not change the API payload.

### Events editor

- Render Feature flag and Segment as two compact bordered groups, stacked on narrow widths.
- Each group has a group checkbox with checked, unchecked, and indeterminate states, followed by every canonical Angular event for that group.
- Readable event labels are translated; canonical values remain the submitted identity and must be available to assistive technology or secondary text.
- Require at least one selected event across both groups. Put the error under the Events section, not in a toast.
- Do not invent event types. The image is illustrative; `WebhookEvents` in the functional reference remains the authoritative event inventory.

### Request editor

- Custom headers use editable Name/Value rows with an icon-only Remove action and `Add header` below the rows.
- Preserve Angular behavior: rows without a header name are omitted from the submitted payload. Retain entered values while editing and do not silently trim or redact the saved payload.
- Header values use password-style masking by default with reveal/hide. Browser password managers and autocomplete should not treat arbitrary header rows as account credentials.
- Payload template type uses a compact `Default` / `Custom` RadioGroup or segmented single-choice control.
- Use CodeMirror 6 for the payload-template editor; do not migrate Angular Monaco or add Monaco to React.
- Default shows the canonical default Handlebars JSON template in a read-only CodeMirror instance. Custom enables editing, undo/redo, selection, search, formatting, and JSON Handlebars validation.
- The embedded editor has a default height of approximately `240px`. Do not add a drag-to-resize handle.
- Put one icon action labeled `Expand editor` at the editor's upper-right. Do not provide a second `Enter full screen` action; both names would represent the same capability.
- Preserve the custom draft when switching from Custom to Default and back during the same Sheet session.
- Show `Prevent empty payloads` as a Switch beneath the template editor. Preserve the backend behavior without rewriting or previewing its semantics.

### Expanded payload-template editor

- `Expand editor` opens one full-viewport editor layer above the Webhook Sheet. Keep the Sheet mounted underneath so every form value and validation state remains unchanged.
- Use a compact top bar with title `Payload template`, a read-only `Default` or `Custom` mode Badge, and one right-aligned action `Exit expanded view` with a Minimize icon.
- The CodeMirror surface fills the remaining viewport height and width with line numbers, active-line treatment, syntax highlighting, selection, search, and diagnostic markers. It is an editing workspace, not a generic Dialog with a small editor inside it.
- Do not add separate Save, Apply, or Cancel actions. Edits update the same parent form draft immediately; saving still happens only through `Save changes` in the underlying Sheet.
- `Esc` and `Exit expanded view` leave expanded mode only. They must not close the Webhook Sheet, discard the draft, or trigger dirty-form confirmation.
- Preserve the document, undo history, selection, cursor, focused line, and scroll position when moving between embedded and expanded views. On exit, return focus to `Expand editor`.
- Default mode remains read-only in both sizes. Custom mode remains editable in both sizes.
- Use the same semantic dark editor theme in light and dark application themes; match existing `background`, border, focus-ring, font, and syntax-token conventions rather than copying Monaco chrome.
- CodeMirror supplies the editing surface and extension system. The existing JSON Handlebars validator remains authoritative because ordinary JSON parsing alone does not understand every Handlebars construct.
- Map validator results to CodeMirror diagnostics and a keyboard-accessible diagnostics panel. Keep raw invalid text intact and identify the failing range/message without rewriting the user's template.
- Formatting must call the JSON Handlebars-safe formatter used by this feature. Do not run a plain JSON formatter over a template when it would alter or reject valid Handlebars expressions.
- If Handlebars variable suggestions are retained from Angular, implement them through an explicit CodeMirror completion source; do not imply that `@codemirror/lang-json` provides domain-specific webhook completions automatically.

### Security editor

- Secret is optional and masked by default with reveal/hide. Preserve an unchanged saved secret without requiring the user to re-enter it.
- Clearing the field deliberately removes the secret on save; distinguish an intentionally cleared value from an untouched masked value in client state.
- Do not echo secret values in validation messages, logs, clipboard confirmation copy, or Live Debug summary UI.

### Save, failure, and reset

- Build the existing payload shape exactly: name, URL, environment selections grouped into serialized project/environment scopes, flattened canonical events, named custom headers, template type/template, secret, Active, and Prevent Empty Payloads.
- On success, close the Sheet, show translated success feedback, merge/refetch the saved row, preserve list filters and pagination, and restore focus to the initiating control.
- On field validation failure, keep the Sheet open, scroll/focus the first invalid control, and retain the full draft.
- On API failure, keep the draft and show a compact inline form-level error above the footer with `Retry`; a toast may accompany it but is not the only feedback.
- Closing a clean or discarded Sheet clears local validation, reveal states, header/scope drafts, custom-template snapshot, and pending name checks.

### Accessibility and responsive behavior

- Trap focus within the Sheet and use a logical order from header through sections to footer. Icon-only actions require translated accessible names.
- Associate required/error state with its control; never rely on red borders alone.
- Switches, checkboxes, reveal actions, multi-select chips, code editing, and footer actions must be fully keyboard reachable.
- At narrow widths, the Sheet becomes full width; General, Events, the environment selection summary, header rows, and footer action groups stack without horizontal page scrolling.
- Preserve normal React product transitions around `150-250ms` and honor reduced motion.

## Live Debug Dialog

Live Debug sends one generated sample event to the webhook's configured endpoint and presents the returned request/response details without leaving the list or submitting a parent form. It is an operational test, not a preview-only simulation: the interface must say clearly that it sends a real HTTP request.

### Entry contexts

The same Dialog supports two entry contexts.

| Entry | Configuration source | Completion behavior |
| --- | --- | --- |
| Main-page `Live debug` | The selected saved webhook | Close back to the same row and restore focus to its `Live debug` button. |
| Add/Edit workflow `Live debug webhook configuration` | The current valid unsaved form values | Close back to the unchanged form draft and restore focus to its Live Debug trigger. Never save or submit the parent form. |

For an unsaved new webhook, use the existing temporary webhook ID behavior. The test response remains local to the Dialog and must not be presented as saved delivery history. The current backend test-send path does not persist the returned delivery or update the webhook's `lastDelivery`; closing Live Debug therefore does not refresh the main-page status or delivery history.

### Dialog frame

- Use a centered shadcn `Dialog` approximately `880px` wide with `max-width: calc(100vw - 40px)`.
- Limit the total height to approximately `min(760px, calc(100vh - 48px))`; keep the header and footer stable while the result body scrolls when necessary.
- Retain the originating page or Add/Edit surface under one neutral dimmed overlay. Do not open a Sheet, navigate to a debug route, or stack another Dialog.
- Use a compact white/`popover` surface, `10-12px` radius, one-pixel border, and the shared Dialog elevation. Do not use a large green success card or developer-console visual theme for the whole Dialog.
- Header title: `Live debug`.
- For a saved webhook, supporting copy: `Send a sample event to {webhookName}.`
- Show a compact read-only target row labeled `Endpoint` with the configured URL in monospace. Truncate visually only when required and expose the complete URL in a tooltip.
- Do not display the webhook secret, signature value, or hidden header values in the header area.

### Event selection

- Use one required, searchable Select labeled `Event`.
- Default to the existing Angular default, `feature_flag.toggled`.
- Group options under `Feature flag` and `Segment` using `SelectContent > SelectGroup > SelectItem`.
- Each option uses a readable translated label as the primary line and its canonical event value as secondary monospace text.
- Search matches both the translated label and canonical value.
- Preserve every canonical Feature Flag and Segment event currently defined by Angular; the displayed label must never alter the submitted value.
- Keep the selected event visible after sending so the user can understand and repeat the exact request.

### Before sending

The initial Dialog is intentionally compact.

1. Header and supporting copy.
2. Read-only Endpoint row.
3. Required Event Select.
4. Quiet footer warning: `This sends a real HTTP request to the configured endpoint.`
5. Footer actions: outline `Close` and primary `Send test webhook` with a Send icon.

Do not show empty Request/Response tabs, placeholder code panels, or a blank result container before the first send.

### Sending behavior

- Generate the example payload from the selected canonical event and current payload template using the existing test-payload behavior.
- Send the current ID, fresh delivery ID, URL, name, secret, custom headers, selected event, generated payload, and `preventEmptyPayloads` value through the existing endpoint.
- Change the primary action to `Sending…` with a small spinner and disable repeat submission.
- Keep Endpoint and Event visible but disabled so the user retains context while the request is pending.
- Replace only the result region with compact skeleton lines; do not skeletonize the header or resize the entire Dialog unpredictably.
- Ignore backdrop clicks while the Dialog is open. While sending, also disable the close button and Escape dismissal so the result cannot be abandoned accidentally. If cancellation is deliberately supported later, expose an explicit `Cancel request` action rather than treating close as cancellation.

### Successful result

After a successful HTTP response, keep the configuration area and add the result beneath a divider.

- Use a compact one-line summary: green CheckCircle, `Delivered successfully`, an outline status badge such as `200 OK`, and right-aligned Clock text `Completed in {duration} seconds`.
- Use a small `Request` / `Response {statusCode}` tab row. Default to `Request` after each send.
- `Request` contains `Headers` and `Payload` sections.
- Request headers include the URL/method and effective request headers returned by the delivery model. Format the payload as JSON when possible and preserve raw text otherwise.
- `Response` contains `Headers` and `Body`. Format the body as JSON when possible and preserve empty or non-JSON bodies honestly.
- Use Shiki or the shared lightweight `CodeBlock`; do not migrate Angular's Prism component.
- Code panels use a compact neutral dark surface, readable syntax colors, monospace text, internal scrolling, selectable text, and a Copy action where the shared CodeBlock provides one. Do not imitate a full IDE or add fake window controls.
- Footer actions become outline `Close` and primary `Send again`. Sending again creates a new delivery ID, uses the currently selected event, and replaces the prior result after the request completes.

### Failed and ignored results

HTTP failure is still a completed delivery and should retain diagnostic detail.

- Replace the success icon/title with destructive styling and `Delivery failed`.
- Show the returned status such as `500 Internal Server Error`, or `ERROR` when no HTTP status exists.
- Keep duration, Request, and Response tabs available whenever their data exists.
- Show the returned error message above the Response headers/body. Do not replace useful request or response detail with a generic toast.
- For an Anti-SSRF rejection, show the backend message explaining that the target must be an absolute HTTP/HTTPS URL resolving to a public IP address.
- When `Prevent Empty Payloads` causes the request to be ignored, use a neutral warning state `Request not sent` with the returned reason. Keep Request details available and omit or disable the empty Response tab.
- A transport/API failure that returns no delivery uses a compact inline error above the footer: `The test webhook could not be sent.` with the preserved `Send test webhook` retry action. A toast may accompany it but must not be the only feedback.

### Dismissal and reset

- When no request is pending, Close, the header X, and Escape close the Dialog. Backdrop click remains disabled to match the deliberate debug workflow.
- Closing clears the returned delivery and local error, stops pending client subscriptions, restores the default event `feature_flag.toggled`, and returns focus to the originating trigger.
- Closing from an Add/Edit workflow does not change any parent draft field, submit the parent form, or refresh the list.
- Closing from the main page keeps name/project filters, pagination, and scroll position unchanged.

### Live Debug accessibility and internationalization

- Trap focus inside the Dialog and preserve the standard shadcn Dialog focus order.
- Associate the Event label with its Select and expose required/error state through the shared control behavior.
- Result meaning uses icon, text, and status code in addition to color.
- Tabs, code-panel scrolling, Copy actions, close controls, and retry actions must be keyboard reachable.
- Translate all UI labels and readable event names through `react-i18next`; preserve canonical event strings, request headers, raw payloads, response content, URLs, and server error text as technical data.
- Use locale-aware duration formatting without excessive precision; preserve the exact backend payload and timestamps inside code content.

## View Logs Sheet

View Logs is the persistent operational history for one saved webhook. It reads deliveries from the existing webhook-deliveries endpoint, limited by the backend to the past 15 days by default. It must remain distinct from Live Debug: a test result is local to the Live Debug Dialog and does not appear here unless backend behavior changes deliberately.

### Entry and surface hierarchy

- Open the same View Logs Sheet from either the Status cell or the `View logs` item in the row's More menu.
- Use a right-side shadcn `Sheet` approximately `960-1000px` wide, with `max-width: calc(100vw - 48px)` and full available height.
- Keep the Webhooks main page mounted under one neutral overlay so name/project filters, pagination, scroll position, and loaded rows remain intact.
- Do not navigate to a separate route, open a centered Dialog, or layer the Sheet above an Add/Edit Sheet.
- Closing returns focus to the exact Status cell or menu item that opened the Sheet.

### Header

- Title: `Delivery logs for {webhookName}`.
- Keep the title on one line. When a user-provided Webhook name is too long, truncate only the name segment and expose the complete title in a tooltip; never shrink or wrap the close button.
- Do not place a subtitle, retention note, or other explanatory text beneath the title.
- Keep the title visible while the body scrolls.
- Use the standard header close X. Do not add an Edit, Live Debug, refresh, export, or delete action to the Sheet header.
- Keep the Header compact and place the filter toolbar directly beneath it with the standard section spacing.
- The backend still defaults to a 15-day `notBefore` range; preserve that behavior without adding retention copy to the Header.

### Filter toolbar

Place the filters on one compact row directly below the header.

#### Event filter

- Use a searchable Select approximately `300px` wide with placeholder/default `All events`.
- Group options into `Feature flag` and `Segment` through `SelectContent > SelectGroup > SelectItem`.
- Show translated readable labels with canonical event values as secondary monospace text, while submitting the canonical value.
- Allow clearing back to `All events`.
- Changing or clearing the event resets the page index to `1` and immediately reloads the server-side list.

#### Time scope

- Between the Event Select and status control, show a small Clock icon followed by `Past 15 days`.
- Use plain `muted-foreground` text at `13-14px`; do not use a filled Badge, border, dropdown arrow, or button treatment.
- This is non-interactive query-scope metadata, not a date-range filter. It communicates the backend's fixed default range without implying that other ranges can be selected.
- Keep it visible during loading, empty, filtered-empty, and error states.
- Do not duplicate this text beneath the Sheet title.

#### Status filter

- Use one compact segmented control with `All`, `Succeeded`, and `Failed`.
- Map `All` to no `success` query value, `Succeeded` to `true`, and `Failed` to `false`.
- Default to `All` each time a new webhook's Sheet is opened.
- Changing status resets the page index to `1` and reloads.
- Status is a single-choice filter; do not represent it with three independent checkboxes.

Keep the current filter controls visible during loading and failure. Do not add date range, endpoint, response-code, free-text, sorting, or refresh controls because the existing API and Angular flow do not expose them.

### Delivery table

Use a single flat bordered table below the filters.

| Column | Content and behavior |
| --- | --- |
| Expansion | A compact ChevronRight rotates downward for the single expanded row. The button has a translated label such as `Show delivery details`. |
| `Status` | An outline badge with CheckCircle plus the response status for success, or XCircle plus the status/`ERROR` for failure. |
| `Event` | Preserve the canonical event string in compact monospace, such as `feature_flag.toggled`. |
| `Happened at` | Show `startedAt` as a locale-aware date and time. Keep seconds because closely spaced deliveries need precise ordering. |

- Preserve server ordering, newest `startedAt` first.
- Make the expansion button or summary row the detail affordance; do not make status badges look like buttons.
- Expand at most one delivery at a time.
- After each successful page/filter load, expand the first returned row by default, matching Angular behavior.
- Clicking the expanded row collapses it. Clicking another row closes the prior detail and opens the selected one.
- Use response status code `200` when a successful legacy result has no response object, matching the current fallback. Use `ERROR` when a failed result has no response status.

### Expanded delivery detail

Render the detail immediately below its summary row inside the same table width. Use a subtle `muted/20` background and internal padding, not a nested Card.

- Use `Request` and `Response {statusCode|ERROR}` tabs.
- Default to `Request` whenever a different row is expanded.
- Place Clock text `Completed in {duration} seconds` at the right edge of the tab row.
- Calculate duration from `endedAt - startedAt` and format it compactly without discarding meaningful sub-second precision.

#### Request tab

- `Headers` shows Request URL, `POST` method, default Accept/Content-Type fields, built-in FeatBit delivery/event/hook headers when returned, and effective custom headers.
- `Payload` shows the exact recorded request payload.
- Format payload JSON with indentation when parsing succeeds; otherwise preserve the original raw string.

#### Response tab

- Put the HTTP status in the tab label so the outcome remains visible even while Request is active.
- Show the returned delivery error message first when one exists.
- `Headers` shows the complete recorded response headers.
- `Body` shows formatted JSON when possible and unmodified text otherwise.
- Empty headers or body use quiet inline text such as `No response headers` or `Empty response body`; do not render a blank dark panel.
- For Anti-SSRF or transport failures without an HTTP response, keep the Response tab available with `ERROR` and show the recorded error message.

Use Shiki or the shared lightweight `CodeBlock` for request/response content; do not migrate Angular's Prism implementation. Code panels use a compact neutral dark surface, selectable monospace text, horizontal/internal scrolling, readable contrast, and no fake editor controls.

### Pagination

- Use server-side pagination with default page size `5`.
- Provide page-size options `5`, `10`, and `20` in the shared compact pagination pattern.
- Show `Showing {start} to {end} of {total} deliveries` on the left and page-size/previous/current/next controls on the right.
- Changing page size resets to page `1`; changing page loads the requested server page.
- Disable unavailable previous and next controls instead of hiding them.
- Keep pagination at the Sheet bottom after the table. If the body must scroll, use a sticky neutral footer without covering expanded content.

### View Logs states

#### Loading

- Keep the Sheet header and selected filters stable.
- Render three compact table skeleton rows. Do not show a page-level spinner or fake expanded code content.
- On subsequent filter/page changes, retain current rows with a subtle updating state when cached data exists.

#### No delivery history

- Message: `No deliveries in the past 15 days.`
- Supporting copy: `New webhook deliveries will appear here after they are sent.`
- Do not offer `Live debug` as an empty-state action because a test result is not persisted in this log.

#### No filtered results

- Message: `No deliveries match these filters.`
- Provide `Clear filters`, restoring `All events`, `All`, and page `1`.

#### Load error

- Keep filters visible and show a compact inline error `Delivery logs could not be loaded.` with `Retry`.
- Retain prior cached data when available; never replace request/response detail with a toast-only failure.

### Closing and reset

- Header X, Escape, and backdrop click close the Sheet when no load transition requires protection.
- Closing clears the selected webhook's local delivery data, resets filters to All/All/page `1`/page size `5`, collapses detail, and returns focus to the trigger.
- Reopening for a different webhook must never flash the prior webhook name, filters, rows, or expanded detail.
- Opening or closing View Logs does not mutate the webhook, update its Status cell, or refresh the main list.

### View Logs accessibility and internationalization

- Trap focus within the Sheet and preserve shared Sheet focus/scroll locking behavior.
- Expansion buttons expose expanded state through the shared table/accordion primitive and remain keyboard reachable.
- Status uses badge text, status code, and icon in addition to color.
- All labels, statuses, empty/error messages, filter choices, pagination copy, and tooltips use `react-i18next`.
- Canonical event names, URLs, HTTP headers, payload/body content, and server error messages remain technical data and are not translated.
- Dates and durations use the active locale. Light and dark themes preserve the same hierarchy and semantic status treatment.

## New Webhook and Removal

### New webhook

- `New webhook` opens the same Sheet structure as Edit mode with title `New webhook` and primary action `Create webhook`.
- Defaults match Angular: Active on, Prevent Empty Payloads off, payload-template type Default, canonical default template loaded, and no scope, event, header, or secret values preselected beyond any existing Angular initialization behavior.
- The same validation, scope/event editors, custom-template draft preservation, unsaved Live Debug behavior, dirty-close confirmation, error handling, and accessibility rules apply.
- On success, close the Sheet, show translated success feedback, refresh the list, and return to page one when required to make the newly created newest-first webhook visible.

### Removal

- Confirm removal with the selected webhook name in the message.
- Do not delete from an unconfirmed menu action.
- On success, show translated success feedback and refresh the list.
- On failure, keep the row and show translated recoverable feedback.
- Backend deletion also removes deliveries; the confirmation should warn that delivery history is removed with the webhook.

## Page States

### Loading

- Keep the page header, filter values, primary action, table header, and pagination geometry stable.
- Render approximately five table skeleton rows rather than a centered page spinner.
- A filter-driven reload should not blank the whole page; retain current rows with a subtle updating state when TanStack Query already has data.

### Empty, no filters

- Render the table container with a compact centered message: `No webhooks yet`.
- Supporting copy: `Create a webhook to send feature flag and segment events to an external service.`
- Include a `New webhook` action that invokes the same workflow as the toolbar button.
- Do not add an illustration or oversized onboarding panel.

### Empty, filters active

- Message: `No webhooks match these filters.`
- Provide `Clear filters`; clear name and project together, reset the page index, and reload.
- Do not replace the toolbar or hide the current filter values.

### List error

- Keep the filters and primary action available.
- Show a compact inline destructive-toned message immediately above the table: `Webhooks could not be loaded.` with `Retry`.
- Retain previous data if available; otherwise show the empty table structure below the message.

### Project-list error

- Keep the project Select present with a load-failed option or helper message and a retry path.
- Name filtering and listing without a project filter remain usable.

### Mutation states

- Disable only the initiating row action or confirmation action while it is pending.
- Never block unrelated table rows during test, delete, or supporting-surface work.
- Use translated toast feedback consistent with other React administration pages.

## Responsive and Overflow Behavior

This is a professional desktop workbench, not a mobile-first surface.

- At wide desktop widths, keep all columns and all scope chips visible without horizontal scrolling; scope chips may wrap to additional compact lines.
- At constrained desktop widths, apply sensible minimum widths and allow the table container to scroll horizontally.
- Do not hide Endpoint, Scopes, Events, or Status behind a generic mobile row menu.
- The toolbar may wrap only when the content area can no longer hold the name search, project filter, and action without overlap. Keep `New webhook` intact and do not convert it to an icon-only button.

## Accessibility and Interaction Quality

- Use semantic table markup and the existing shadcn/Base UI focus behavior.
- Every icon-only More or pagination button requires a translated visible tooltip or accessible label.
- Tooltips/popovers for a truncated URL, an individually truncated scope name, and summarized events must be keyboard reachable.
- Use the shared Dialog/Sheet primitives for supporting surfaces and confirmation rather than nested custom overlays.
- Restore focus to the originating control when a supporting surface closes.
- Keep normal product transitions within approximately `150-250ms`; use motion only for menus, overlays, and state feedback.

## Internationalization

- All headings, labels, placeholders, statuses, messages, menu items, tooltips, pagination copy, relative times, and toast feedback must use `react-i18next`.
- Event labels may be translated, but API request values remain canonical strings such as `feature_flag.toggled`.
- Let table columns truncate dynamic strings rather than forcing translated controls to fixed English widths.
- Format absolute dates and times with the active locale; do not preserve Angular's hard-coded `en-US` formatting.

## Functional Invariants

The React Webhooks experience is incomplete unless all of these remain true:

1. The list is organization-scoped and ordered newest-created first.
2. Only name and project filters appear on the main page and call the existing server-side semantics.
3. Name search is debounced and every filter change returns to page one.
4. Pagination remains server-side with `10`, `20`, and `30` page sizes.
5. The page shows webhook name, creator, active state, most recent delivery, endpoint, scope names, and selected events.
6. Every scope is visible directly in the table; truncation or event summarization never makes full URL, scope, or event information inaccessible.
7. New, View-by-name, visible Edit, Live debug, View logs, and Remove entry points remain available.
8. Status and delivery-result affordances remain distinct: active state is configuration; last delivery is operational history.
9. No environment filter, inline status toggle, bulk mutation, sorting, or other unsupported filter is added.
10. Create/edit, unsaved live debug, saved live debug, delivery history, delivery detail, and removal preserve the Angular behavior listed in this document.
11. The sidebar and context bar remain untouched.
12. Saved-row and valid unsaved-form Live Debug entries reuse the same Dialog without saving or submitting a parent form.
13. Live Debug sends a real request generated from the selected canonical event and current webhook configuration.
14. Completed tests expose status, duration, request headers/payload, response headers/body, and returned errors whenever available.
15. A Live Debug result remains local to the Dialog and is not represented as persisted delivery history or a new main-page `lastDelivery` value.
16. Closing Live Debug clears its local result/error state, restores the default event, preserves the underlying page/form state, and restores focus to the trigger.
17. Status-cell and More-menu `View logs` entries open the same right-side Sheet and include the selected saved Webhook name in its title.
18. View Logs displays `Past 15 days` as read-only toolbar metadata and defaults to that range, All events, All statuses, page `1`, and page size `5`.
19. Event and success filters remain server-side and reset pagination to page one when changed.
20. At most one log is expanded; the first returned log expands by default and exposes complete request, response, error, status, event, time, and duration data.
21. View Logs remains server-paginated and preserves newest-first delivery ordering.
22. Closing View Logs resets Sheet-local state, preserves the main-page state, restores focus, and performs no webhook mutation.
23. View and Edit use one right-side Sheet with identical General, Scopes, Events, Request, and Security section order.
24. View mode masks secrets and arbitrary custom-header values by default while retaining accessible reveal and copy behavior.
25. Edit preserves every Angular field, canonical event, validation rule, custom-template draft, scope serialization rule, and create/update payload field.
26. Unsaved Live Debug uses the current valid Edit/New draft and never saves, closes, or submits the parent Sheet.
27. Dirty Edit/New drafts require explicit discard confirmation before closing.
28. Payload templates use CodeMirror 6 in embedded and expanded modes; Monaco is not part of the React implementation.
29. `Expand editor` is the single enlargement action and preserves the same form draft, undo history, selection, cursor, validation, and scroll state.

## Final Design Rejections

- no Angular/ng-zorro visual cloning;
- no sidebar or context-bar redesign;
- no status metric cards or delivery chart above the list;
- no card-per-webhook layout;
- no green-dominant page styling;
- no environment filter on the main page;
- no separate Active and Last delivery columns;
- no `+N` summary, tooltip-only list, or popover-only list in the Scopes column;
- no moving the visible `Edit` action back into the More menu;
- no hidden last-delivery failure behind hover-only UI;
- no hover-triggered row action menu;
- no entire-row click target;
- no opening Edit when the user activates the webhook name; the name opens View and the visible Edit action opens Edit;
- no disabled-form styling as a substitute for an intentional View mode;
- no collapsing View/Edit scopes to `+N`;
- no separate Project Select, per-project scope rows, or `Add scope` workflow in Webhook Edit; use the Relay Proxy Environment Picker pattern;
- no unsupported `All environments` option for Webhooks;
- no revealing secret or custom-header values by default;
- no silently discarding a dirty Edit/New draft;
- no Monaco editor in the React Webhook workflow;
- no separate `Expand editor` and `Enter full screen` actions, and no drag-resize handle;
- no expanded-template Save/Apply action that competes with the parent Sheet's `Save changes`;
- no inline enable switch unsupported by the Angular main page;
- no mobile redesign that removes operational columns;
- no Live Debug Sheet or separate debug route;
- no large success card that displaces request and response diagnostics;
- no toast-only failure that hides returned request, response, or error detail;
- no Live Debug action that submits or mutates an Add/Edit parent form;
- no claim that a test result was added to persisted delivery history;
- no centered View Logs Dialog or separate logs route;
- no View Logs title that omits the selected Webhook name;
- no retention subtitle beneath the View Logs title and no hiding the fixed 15-day range from the user;
- no styling `Past 15 days` as an interactive date-range control;
- no mixing Live Debug results into the persisted View Logs list;
- no multiple expanded log rows;
- no extra date-range, response-code, text-search, or sorting filters unsupported by the existing logs API flow;
