# IAM Team Page Design

This document is the React design contract for the IAM Team list page and its `Add team member` sheet. Angular remains a functional reference for permissions and API behavior, but the React implementation must use shadcn/ui, Base UI primitives, Tailwind tokens, and the authenticated layout defined in [react-layout-design.md](react-layout-design.md).

The Team member detail page has a separate React design contract in [iam-team-detail-page-design.md](iam-team-detail-page-design.md).

## Design Asset

- Add member sheet, light theme: [iam-team-add-member-sheet-light.png](iam-team-add-member-sheet-light.png)

The saved image is a visual baseline for hierarchy, density, spacing, and semantic color usage. It is not permission to redesign the Team list behind the sheet.

## Team List Invariant

Opening `Add team member` must overlay the existing Team page without changing its structure.

The Team page keeps:

- page title `Team`;
- subtitle `Manage organization members and their effective access.`;
- `Filter by email` search input;
- `Add member` primary action;
- table columns `Email`, `Name`, `Groups`, `Initial password`, and `Actions`;
- `Details` and `Manage` row actions;
- current authenticated sidebar and top context bar.

Do not add Team-page tabs, role filters, avatars, alternative columns, or a new navigation model as part of the sheet design.

## Add Team Member Sheet

Use a right-side shadcn `Sheet`, approximately `500px` wide on desktop and constrained to the viewport on smaller screens.

The sheet contains:

1. Header with `Add team member` and the standard close button.
2. Email field.
3. Permissions heading with `Select at least one policy or group.` helper text.
4. Independent `Policies` selector.
5. Independent `Groups` selector.
6. Sticky footer with the right-aligned `Add member` primary button.

Keep the sheet compact. Do not add a Cancel button, introductory subtitle, extra fields, tabs, or large decorative cards unless this contract is updated first.

## Policy And Group Components

Policies and Groups are separate components with the same interaction model. Each owns its search query, async results, loading state, selected values, and selection count.

Each component is divided into three visually distinct areas:

### Header

- Plural title: `Policies` or `Groups`.
- Selection count aligned to the right, for example `2 selected`.
- Compact horizontal padding and a subtle bottom border.

### Selected Items

Place selected items before the search results so the current access assignment is immediately visible.

- Use a subtle `bg-muted/30` surface.
- Show `Selected policies` or `Selected groups` on the left.
- Show `Clear all` on the right when at least one item is selected.
- Render each selected value as a removable compact chip.
- Keep chips on multiple lines when necessary; do not introduce horizontal scrolling.
- Removing a chip must update the corresponding result-row selected state.

This area represents the current form value. It must not look like another set of search results.

### Search And Available Results

- Use a shadcn `CommandInput`-style search field.
- Use equal vertical padding above and below the input.
- Separate the input and results with whitespace and a subtle border.
- Limit result height and show a thin scrollbar when content overflows.
- Keep `4px` vertical spacing between result rows so adjacent selected rows do not merge visually.
- Selected result rows use the standard neutral shadcn `accent` state and a check icon.
- Unselected rows remain on the normal background.
- System-managed policies show a star icon and `System` metadata.
- Selected values remain in the selected-items area even when a search query filters them out of the available-results area.

Search results must match the current query. Do not merge unrelated selected options into the filtered result list.

## Semantic Color Contract

Use shadcn semantic tokens rather than product-specific colors:

| Element | Token direction |
| --- | --- |
| Sheet and normal surfaces | `background` |
| Primary text | `foreground` |
| Helper and metadata text | `muted-foreground` |
| Dividers and outlines | `border` |
| Selected-items surface | `muted/30` |
| Selected chips | `secondary`, `secondary-foreground`, neutral border |
| Selected result row | `accent`, `accent-foreground` |
| Search focus | standard `ring` behavior |
| Submit action | default `primary`, `primary-foreground` |

Do not use custom green, blue, or purple fills to distinguish selected items. The distinction comes from structure, labels, spacing, neutral surfaces, and standard selected states. FeatBit brand color remains reserved for the product brand and rare accents.

Apply the same semantic hierarchy in dark mode. Do not hard-code light-theme hex values.

## Interaction And Validation

- Policies and Groups support async search and multiple selection.
- Use API page size `10` for both option lists.
- Do not request or display available results before the search input is focused.
- On first focus, load the unfiltered first page. Typing searches by keyword; clearing the keyword reloads the unfiltered first page.
- Use a bottom sentinel with `IntersectionObserver` for pagination. When more pages are available, a visible sentinel loads and appends the next page without duplicating options; this also fills a result area whose first page is too short to scroll.
- Debounce search requests.
- Show compact loading skeletons while results load.
- Show a translated empty result state.
- Require a valid email.
- Require at least one Policy or Group.
- Clear the email error as soon as the email becomes valid.
- Clear the permissions error as soon as either selector contains a value.
- Disable the submit action and show its saving label while the request is in flight.
- On success, close the sheet and refresh the Team list.

## Internationalization

- All user-visible text belongs in the IAM feature resource file.
- Preserve Angular terminology where it remains appropriate, including `添加成员`, `权限`, `策略`, `组`, and `初始密码`.
- English selector titles use plural forms: `Policies` and `Groups`.
- Do not introduce hard-coded user-visible strings in feature components.

## Accessibility

- Associate the email label and input.
- Set `aria-invalid` when email validation fails.
- Keep all selector rows keyboard navigable through the Command primitive.
- Provide accessible names for chip remove buttons and icon-only actions.
- Maintain visible focus rings using shadcn tokens.
- Do not rely on color alone to communicate selection; retain check icons, selected-area placement, and text labels.

## Acceptance Criteria

- The Team list remains unchanged when the sheet opens.
- Policies and Groups are independent searchable multi-select components.
- Selected items and available search results are immediately distinguishable without custom colors.
- Selected chips and result-row state remain synchronized.
- Search returns only matching options.
- Results scroll after reaching their maximum height.
- Adjacent selected result rows retain visible spacing.
- Email and permissions validation clear reactively.
- Light and dark themes use shadcn semantic tokens.
- English and Chinese routes show translated IAM text.
