# Access Token Page Design

This document is the React design contract for the Access Tokens list page, its New, Edit, and View Sheet states, and the one-time creation result. Angular remains the read-only functional reference for API behavior, permissions, resource names, validation, and one-time token disclosure. The React implementation must use the current FeatBit shadcn/ui, Base UI, Tailwind, TanStack Table, React Hook Form, Zod, and authenticated-workbench conventions without visually cloning ng-zorro.

## Scope

- Design only the main content and right-side Sheets.
- Keep the existing authenticated sidebar and context bar unchanged.
- Preserve Personal and Service token behavior, permission actions, resource scoping, validation, pagination, one-time token disclosure, and edit restrictions.
- Design for compact professional desktop workflows.

## Required Design Baselines

- Main page: [access-token-list-light.png](access-token-list-light.png)
- New access token Sheet: [access-token-new-sheet-resource-scope-light.png](access-token-new-sheet-resource-scope-light.png)
- Edit access token Sheet: [access-token-edit-sheet-resource-scope-light.png](access-token-edit-sheet-resource-scope-light.png)

These images are the required light-theme baseline for hierarchy, density, spacing, control placement, and Resource scope treatment. The written interaction rules in this document remain authoritative for dynamic, loading, validation, empty, disabled, and success states that a static image cannot show.

## Main Page

### Header

- Title: `Access Tokens`.
- Subtitle: `Create and manage tokens used to access the FeatBit API.`
- Use the established React page-header rhythm: compact 24px semibold title, 14px muted subtitle, and no decorative content.
- Do not add summary cards, tabs, token counts, API documentation callouts, or a secondary header action.

### Toolbar

Keep all filters and the primary action on one horizontal row:

- Left: name search, Creator filter, and Type filter.
- Right: the `New access token` primary button with a leading plus icon.
- Name search uses the placeholder `Filter by name...` and the standard search icon.
- Creator is clearable, searchable, and remotely resolves organization members by name or email. Use the compact visible placeholder `Creator`.
- Type is clearable and contains `Personal` and `Service`. Use the compact visible placeholder `Type`.
- Debounce the list query by approximately 300ms. Debounce remote creator search by approximately 500ms.
- Any filter change resets pagination to page one.
- Hide `New access token` only when the user can manage neither Personal nor Service tokens.
- Keep the controls at the current compact React height and do not stretch the Selects to fill the toolbar.
- Do not add a Status filter, filter chips, bulk actions, a second toolbar row, or an explicit Apply button.

### Table

Use a server-driven TanStack Table. The bordered table is the only container in the list area; do not wrap it in an outer Card.

| Column | Design |
| --- | --- |
| Name | Token name as the primary row text. |
| Type | Plain `Personal` or `Service` text; never a Badge. |
| Created by | Creator name, falling back to email when the name is empty. |
| Status | A small semantic dot followed by plain `Active` or `Inactive` text. Do not use a status Badge. |
| Last used | Localized existing timestamp; show `-` when the token has never been used. |
| Access token | The masked token value returned by the API. Never reveal the complete token from the list. |
| Actions | Compact ellipsis menu for manageable tokens; plain `View` action when the user lacks manage permission for that token type. |

Table geometry follows the existing React workbench:

- subtle one-pixel border and restrained radius;
- neutral header background;
- thin row dividers and quiet hover state;
- compact, vertically centered cells;
- no row-selection checkboxes, avatars, Type pills, or token-prefix badges;
- keep long names, creator values, and masked token strings from forcing horizontal overflow.

### Row actions and permissions

The action menu preserves the Angular behavior:

- `Edit` opens the Edit Sheet.
- Active token: `Deactivate`.
- Inactive token: `Activate`.
- `Remove` is destructive and irreversible.
- Personal-token actions require `ManagePersonalAccessTokens`.
- Service-token actions require `ManageServiceAccessTokens`.
- Without the matching permission, replace the menu with `View` and open the Sheet in a non-editable state.

Use a confirmation Dialog for Deactivate and Remove rather than copying the Angular popconfirm:

- Deactivate explains that API calls will stop and that the token may be activated again.
- Remove names the token and states that the operation cannot be reverted.
- Disable the confirmation action while the request is in flight.
- Preserve the current row and show actionable failure feedback when a mutation fails.

### Pagination

Keep pagination outside the bordered table in one standalone row:

- Left uses the exact pattern `Showing {from} to {to} of {total} access tokens`, for example `Showing 1 to 3 of 3 access tokens`.
- Right contains the page-size Select and compact Previous/Next controls.
- Supported page sizes remain `10`, `20`, and `30`.
- Use zero-based or one-based indexes internally as required by the API adapter, but never expose implementation indexing in the UI.

### Main-page states

- Loading: preserve the toolbar and table shell; use row skeletons rather than a centered page spinner.
- Initial empty state: keep the toolbar visible and explain that no access tokens exist. Show `New access token` when the user is allowed to create one.
- Filtered empty state: show `No access tokens match your filters.` and retain the filters so they can be cleared.
- Load failure: keep the page structure visible, show a translated failure message, and provide Retry.
- Mutations update or refetch the current server page without resetting unrelated filters.

## New and Edit Access Token Sheets

### Shared Sheet frame

- Use a wide right-side shadcn Sheet, approximately 850px on desktop and constrained to the viewport.
- The Sheet is the only elevated surface. Use the neutral React workbench tokens, thin separators, compact 32px controls, and no decorative Card wrappers.
- Keep the standard close action in the upper-right corner.
- The body scrolls independently when the permissions editor exceeds the viewport.
- Keep the primary action visible at the lower-right of the Sheet.
- Do not add a footer divider.
- Do not add a Cancel button; the standard close action remains the exit.
- Disable the primary action and show an in-progress label while submitting.
- Closing the Sheet discards unsaved changes and must never mutate the list.

### Header copy

| State | Title | Subtitle |
| --- | --- | --- |
| New | `New access token` | `Create a token for API access.` |
| Edit | `Edit access token` | `Update the token name and service permissions.` |
| View | `View access token` | `Review the token details and service permissions.` |

### Name field

- Name is required.
- Use the standard compact Input and visible `Name` label.
- Validate duplicate names through the existing API after a short debounce.
- New validation copy: `Access token name cannot be empty.`
- Duplicate validation copy: `This access token name is not available.`
- Keep field values and show inline validation when a request fails.

### New Sheet

- Type is selectable and defaults to Personal.
- The Service baseline image intentionally shows the expanded permission editor.
- Footer action: `Create token`.
- Hide the New action entirely when the user can manage neither token type.
- If the user can manage only one token type, keep both types understandable but prevent submission of the unauthorized type using the established disabled or validation treatment.

### Edit Sheet

- Prefill Name, Type, and the saved permission model.
- Type is read-only and uses the standard disabled Select treatment.
- Footer action: `Save changes`.
- Never show the complete or masked token value inside Edit.
- A successful save updates the matching list row without resetting unrelated filters or pagination.

### View Sheet

- Use the Edit structure but render Name, Type, permissions, scopes, selected resources, and action states as non-editable.
- Do not expose `Save changes`, Add resource, remove-resource controls, Select all, or editable checkboxes.
- The standard Sheet close action is the only footer-independent exit.
- View is required when the user lacks manage permission for the row's token type.

### Type helper copy

Show only the helper that matches the current Type:

- Personal: `Personal tokens use your user permissions`
- Service: `Service tokens require explicit permissions`

The Edit Sheet follows the same rule for its fixed current Type. Do not display both sentences together and do not replace the current-type explanation with an editability message.

### Type control behavior

- Use the standard compact React Select rather than large type cards.
- Options are `Personal` and `Service`.
- Every Select follows the required `SelectContent > SelectGroup > SelectItem` composition.
- Changing Type immediately updates the helper copy and the visibility of Permissions.
- Preserve entered Service permissions as local draft state if the user temporarily switches to Personal and returns to Service before closing the Sheet.

### Permissions editor

- Personal tokens do not show the permissions editor.
- Service tokens show the permissions editor and require at least one valid permission statement.
- Heading: `Permissions`.
- Supporting copy: `Choose only the API capabilities this service needs.`
- Resource categories remain ordered: Feature flag, Segment, Project, Environment, IAM, Workspace.
- Separate categories with thin dividers instead of individual Cards.
- Category header: resource name, muted `{count} selected` summary, and Select all on the far right.
- Render actions in a compact two-column grid.
- Preserve the existing action names and do not replace them with broad invented summaries.
- Keep the existing action information tooltip beside actions that need clarification.
- Category Select all is tri-state and changes only actions the current user is authorized to grant.
- Unauthorized actions and unlicensed fine-grained actions remain visible but disabled.
- IAM and Workspace keep their action lists but never display Resource scope.
- When no valid action is selected anywhere, block Service submission and show `Select at least one permission.`
- Do not use a global Select all across every resource category.

## Resource Scope

Resource scope is a per-category decision shared by every selected action in that category. It is not a token-level setting and cannot vary between actions inside the same category.

### Supported categories

Only these categories expose a scope choice:

- Feature flag
- Segment
- Project
- Environment

IAM and Workspace do not display a Resource scope control or read-only scope row. Their existing wildcard behavior remains implicit and unchanged.

### Control pattern

Use a compact, plain inline RadioGroup rather than a full-width Select or two button-like cards.

```text
Applies to    ○ All    ○ Specific
```

- Use the plain-language label `Applies to`, not the implementation term `Resource scope`.
- The RadioGroup has no surrounding card, filled background, or segmented-button border.
- Keep the options on one line at content width; do not stretch them across the Sheet.
- `All` is the default for a new permission category.
- The category heading supplies the resource context. The accessible group name must be category-specific, such as `Feature flag scope`.
- The visible option labels remain `All` and `Specific`; assistive naming may announce `All feature flags` and `Specific feature flags` through the component's standard labelling relationship.

This pattern keeps both consequences visible, removes the extra open/select interaction of a Select, and avoids the oversized appearance of button cards.

### All state

- Hide resource-management content.
- Saving uses the existing wildcard resource name for that category.
- Do not add explanatory cards or repeat the category name beneath the RadioGroup.

### Specific state

Reveal one compact management block immediately below the RadioGroup:

```text
Selected resources · 2                         Add resource
[ production / beta-users  × ] [ staging / early-access  × ]
```

- Keep `Selected resources · {count}` and `Add resource` on one row.
- `Add resource` is a compact secondary or ghost action, not a full-width button.
- Show every selected resource; do not collapse items into `+N more`.
- Selected items use compact wrapping chips or rows according to resource-name length.
- Clicking the item text edits that resource; the trailing remove control only removes it.
- Long resource names truncate or wrap safely while retaining access to the full value through the established tooltip behavior.
- Ignore duplicate resources and preserve the existing multi-resource capability.

### Empty and validation states

When Specific is selected with no resources:

```text
Selected resources · 0                         Add resource
No resources selected.
```

- If the category has one or more selected actions, block submission and show `Select at least one resource.` beside this scope group.
- Focus the first invalid scope group after an attempted submission.
- If the category has no selected actions, omit that category from the submitted permission statements and do not raise a scope error.
- Never interpret an empty Specific selection as All.

### Mode changes

- Switching to All hides the Specific resource list and broadens the submitted scope to the category wildcard.
- Preserve the current Specific selections as unsaved Sheet draft state while the Sheet remains open.
- Switching back to Specific restores that draft list instead of silently discarding the user's work.
- Reopening the Sheet reconstructs the state from the saved token permissions.

### Read-only and disabled states

- Preserve the visible All/Specific selection and every selected resource.
- Disable interaction without lowering text contrast to an illegible level.
- Disabled permission actions must not be changed by category Select all.

## Resource Scope Rejections

Do not use any of the following:

- a nearly full-width scope Select repeated under every configurable category;
- two large `All resources` / `Specific resources` buttons or selection cards;
- a global token-level scope control;
- a single-resource dropdown for Specific;
- scope controls for IAM or Workspace;
- different resource scopes for actions inside the same category;
- hidden selected resources or `+N more` summaries;
- automatic fallback from empty Specific to All.

## Creation Result

After a successful creation, reveal the complete token value once with a clear copy action and warning that it will be masked after leaving. Editing never reveals the complete token value again.


### Creation-result flow

1. Close the form Sheet.
2. Refresh the current list page without clearing filters.
3. Open a focused shadcn Dialog titled `Access token created`.
4. Show the token name and complete token value.
5. Show the warning `Copy and save this token now. The token value will be masked once you leave this dialog.`
6. Provide a clear copy action beside the token value.
7. Use one primary `Done` action.

The complete value is visible only in this result:

- Do not reveal it again after the Dialog closes.
- Do not expose it from Edit, View, the table, toast content, logs, or error messages.
- A copy success uses the established translated success toast.
- The result Dialog remains open if copying fails; copying is helpful but not required to press Done.

## Submission and Feedback

### Create

- Validate Name before submission.
- Personal submits no explicit permission statements.
- Service submits the configured permission statements and must contain at least one selected action.
- Keep the Sheet open and preserve every field when creation fails.
- Surface the existing service-policy requirement as actionable translated feedback rather than clearing the form.

### Edit

- Update Name and Service permissions only; Type never changes.
- Keep the Sheet open and preserve edits when saving fails.
- On success, close the Sheet, update or refetch the matching row, and show the established translated success toast.

### View

- View never submits data and never exposes a loading primary action.

## Focus, Keyboard, and Accessibility

- Opening a Sheet focuses the first editable field; closing returns focus to the action that opened it.
- Escape and the standard close action dismiss the Sheet unless a submission is actively preventing duplicate interaction.
- Preserve the standard keyboard and focus behavior of shadcn Select, RadioGroup, Checkbox, Dialog, and Sheet primitives.
- Every scope RadioGroup has a category-specific accessible name, such as `Feature flag scope`.
- Every remove-resource control identifies the affected resource, for example `Remove production / beta-users`.
- Every Previous, Next, copy, close, and overflow action has a translated accessible name.
- Do not communicate Active, Inactive, selected, disabled, invalid, or destructive meaning through color alone.
- Keep visible body and helper text at WCAG AA contrast in light and dark themes.

## Internationalization

- Every visible string, validation message, tooltip, toast, confirmation, accessible name, empty state, result summary, and page-size label is translated through react-i18next.
- Keep dates localized while preserving the existing backend value and sorting behavior.
- Resource names, action identifiers, masked token strings, and complete token values are data and must not be translated.
- Layout must tolerate longer translated Type labels, action names, and validation copy without clipping controls.

## Theme and Layout Boundaries

- The required images document the light theme. Dark theme uses the same hierarchy and structure through existing semantic tokens.
- Do not introduce a separate dark-theme composition.
- Optimize the authenticated page and wide permission Sheet for desktop-class screens.
- On a constrained viewport, keep the Sheet within the viewport and let its body scroll; do not redesign it as a multi-step mobile wizard.
- Do not modify the authenticated sidebar or context bar.

## Final Design Rejections

- no Angular/ng-zorro visual cloning;
- no Type Badge in the main table;
- no full-width Resource scope Select;
- no large All/Specific button cards;
- no footer divider or Cancel button in New or Edit;
- no permission summary that replaces the complete action list;
- no hidden selected resources or `+N more`;
- no main-page metrics, summary Cards, or additional toolbar rows;
- no complete token value outside the one-time creation result.
