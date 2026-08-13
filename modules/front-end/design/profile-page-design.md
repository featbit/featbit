# Profile Page Design

This document defines the React design target for the account Profile page. Angular remains the functional reference, but React should treat Profile as an account-level surface opened from the left-bottom Account menu. Do not keep it as an Organization tab and do not copy Angular/ng-zorro styling.

## Scope And Boundaries

This design document covers only the Profile page content area inside the authenticated layout.

- Implementing this page must not modify authenticated layout primitives such as the context bar, sidebar navigation groups, top-right subscription/license badge, layout spacing contract, or route-level layout frame.
- The Account menu `Profile` item is the entry point. Clicking it navigates to the independent Profile page.
- Profile is not part of Organization. `/organization/profile` may exist only as a backward-compatible alias that redirects to the account Profile route.
- The page must preserve every Angular Profile behavior: update current user's name/email; reset password for local-origin users only; validate email, current password, new password, and confirm password.
- Do not add account-avatar upload, profile images, multi-factor authentication, sessions, API tokens, notification preferences, or extra read-only identity panels in this migration. They are not present in Angular's functional scope.

## Design Assets

- Light theme concept: [profile-page-light.png](profile-page-light.png)
- Authenticated layout contract: [react-layout-design.md](react-layout-design.md)
- Organization compatibility notes: [organization-page-design.md](organization-page-design.md#account-profile-compatibility)

The mockup shows only the Profile page content area. It intentionally excludes the sidebar, Account menu, context bar, and subscription badge because those are layout-owned surfaces and must not be changed by Profile implementation work.

The mockup and this contract must follow the current `front-end` implementation, not legacy design images. Use the real React styles from `WorkspaceLayout`, `Section`, `Input`, `Button`, and existing Workspace/Organization general-setting sections as the source of truth.

## Angular Functional Reference

Angular currently renders Profile inside Organization and provides two forms:

- Profile form:
  - `Name`
  - `Email`
  - Submit action: `Update Profile`
  - Endpoint behavior: update `/api/v1/user/profile`
  - On success: show success toast and update stored user profile.
- Reset password form:
  - Visible only when `profile.origin === Local`
  - `Current Password`
  - `New Password`
  - `Confirm new password`
  - New password requires at least 6 characters.
  - Confirm password must match new password.
  - Endpoint behavior: update `/api/v1/identity/reset-password` with current and new password.
  - On success: show success toast and reset the password form.
  - On backend failure with a returned reason: show warning text with the reason.

React should preserve this behavior while improving structure, density, error placement, and route ownership.

## React Information Architecture

Route family:

```text
/:lang/account/profile
```

Compatibility route:

```text
/:lang/organization/profile -> /:lang/account/profile
```

Entry point:

- The left-bottom Account menu item `Profile` navigates to `/:lang/account/profile`.
- The Account menu remains a dropdown. Do not turn Profile into a nested sidebar item and do not add an Account navigation group for this migration.
- The global context bar remains `Organization / Project / Environment`; Profile does not change or replace it.

Page header:

- Title: `Profile`
- Subtitle: `Manage your personal account details and local password.`
- No page-level action buttons. Save actions belong inside their relevant sections.

Content order:

1. Account details
2. Password, only for local-origin users

## Account Details Section

Purpose:

Users update the personal identity shown in the Account menu, audit/operator labels, and account-related emails.

Fields:

- `Name`: optional text field, prefilled from stored profile.
- `Email`: required email field, prefilled from stored profile.
- `Account type`: read-only badge derived from `origin`, for example `Local account`, `SSO account`, or `Social account`.

Action:

- Primary button: `Save profile`

Behavior:

- Use React Hook Form + Zod.
- Email is required and must be a valid email.
- Name may be empty for parity with Angular.
- Disable `Save profile` while the mutation is in progress.
- On success, update the stored `auth` profile payload, refresh any layout/account-menu profile state, and show toast `Profile successfully updated`.
- On request failure, keep user input in place and show toast `Operation failed, please try again`.
- If the backend returns field-level validation, show it inline below the field.

Layout:

- Use the current settings-section structure: `border-b py-8 first:pt-7 last:border-b-0`, not a card wrapper.
- `Name` and `Email` sit side by side at normal desktop widths, then collapse to one column.
- Use standard shadcn input rhythm: `h-8`, `rounded-lg`, neutral border, compact label spacing, no input prefix icons.
- Inputs must use the current shared `Input` style: `border-input`, transparent background, `px-2.5`, `md:text-sm`, and default focus ring.
- Section footer must use the same rhythm as `organization/general/components/section-shell.tsx`: `mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between`. Place helper text immediately after the last field group, not near the bottom of the section.
- The action uses the current shared `Button` default variant, not blue styling. Match `size="lg"` or the local settings action width used by nearby settings pages.
- Do not float buttons.

## Password Section

Purpose:

Local users can reset their own password without leaving the account page.

Visibility:

- Show this section only for local-origin users.
- For SSO or social users, omit the section entirely. Do not show a disabled password form.
- If product later wants explanation for external accounts, use one compact read-only note near `Account type`, not a full empty password section.

Fields:

- `Current password`: required password field.
- `New password`: required password field, minimum 6 characters.
- `Confirm new password`: required password field, must match `New password`.

Action:

- Primary button: `Reset password`

Behavior:

- Use React Hook Form + Zod.
- Validate required fields, minimum length, and confirmation mismatch inline.
- Keep the submit button disabled while resetting.
- Submit the current password and new password. Do not submit the confirmation field as a separate backend value.
- On success, show toast `Reset password success` and clear all password fields.
- If the backend returns `{ success: false, reason }`, show a warning toast `Reset password failed, reason: {reason}.` and keep the form open.
- On request error, show toast `Operation failed`.

Layout:

- Use one settings section below Account details with the same divider rhythm, not a bordered card.
- First row: `Current password` and `New password`.
- Second row: `Confirm new password` in the left column only.
- Use a small tooltip/info icon next to `New password` only if the local tooltip component is already standard; otherwise put `Minimum 6 characters` as field helper text.
- Section footer must sit immediately after the password field grid with the same Organization General `SectionFooter` rhythm, not at the section bottom.
- The `Save profile` and `Reset password` buttons should share the same compact height and similar visual width.
- The reset action uses the current shared `Button` default variant, not blue styling.

## Visual Direction

Color strategy: Restrained. Profile is personal account management inside a professional workbench, so neutral shadcn surfaces, borders, and compact typography should carry the hierarchy.

Theme scene sentence: A developer or administrator is adjusting their own account details during normal workspace use on a desktop screen, likely between release-management tasks, and needs the page to feel calm, direct, and clearly separate from organization administration.

Rules:

- Follow the current React authenticated layout language from `react-layout-design.md`.
- Match the current `front-end` implementation style from `WorkspaceLayout`, `workspace/general/components/workspace-shell.tsx`, `workspace/general/components/form-fields.tsx`, `organization/general/components/section-shell.tsx`, and shared `Button`/`Input` components.
- Use the actual page container contract: `-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6`.
- Use the actual page header contract: `mb-5 space-y-1`, `text-2xl font-semibold tracking-normal`, and `text-sm text-muted-foreground`.
- Use actual section rhythm: `border-b py-8 first:pt-7 last:border-b-0`.
- Use actual field rhythm: labels with `text-sm font-medium`, field wrappers with `space-y-2` or `flex flex-col gap-2`, and two-column rows with `grid gap-5 lg:grid-cols-2`.
- Use compact settings sections, not Angular's large blank vertical blocks.
- Use neutral section dividers and form rows instead of standalone cards when the page background already provides separation.
- Use bordered surfaces with no ambient shadows only if the local page pattern requires a bounded panel.
- Use the current neutral shadcn palette from `front-end/src/index.css`: `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `border-input`, and `bg-primary text-primary-foreground`.
- Do not use legacy blue primary buttons unless the existing React component for this surface already does so.
- Do not use old Angular input prefix icons.
- Do not use large green brand accents, colored side borders, decorative cards, or marketing-style composition.
- Use lucide icons only where recognition helps: `User`, `Mail`, `Lock`, `Shield`, `Info`, `Copy`.
- Keep both light and dark themes structurally identical.
- Keep text labels and actions concise; this page is a settings workbench, not onboarding.
- Do not include extra read-only identity panels, sidebar, account dropdown, context bar, subscription badge, or any other layout-shell chrome in Profile page design assets.

## Key States

- Loading: skeletons matching Account details and Password.
- Local user: show Account details and Password.
- Non-local user: show Account details only, plus one compact note below the Account type badge if needed: `Password is managed by your identity provider.`
- Saving profile: disable only `Save profile`; do not block password fields.
- Resetting password: disable only `Reset password`; do not block profile fields.
- Invalid email: inline error below `Email`.
- Missing current password: inline error below `Current password`.
- Missing or short new password: inline error below `New password`.
- Password mismatch: inline error below `Confirm new password`.
- Successful profile update: toast `Profile successfully updated`; Account menu name/email refreshes.
- Successful password reset: toast `Reset password success`; password fields clear.
- Backend reset failure with reason: warning toast with the returned reason.
- Request error: toast `Operation failed, please try again` for profile and `Operation failed` for password reset, matching Angular's existing password error copy where possible.

## Interaction Model

- Account menu item click closes the menu and navigates to `/:lang/account/profile`.
- Browser back returns to the previous authenticated page.
- Forms submit independently. Updating profile must not mark password as saving; resetting password must not mark account details as saving.
- Password fields should use browser-native password behavior. A reveal icon is optional only if the shared password-input pattern already exists.
- Profile update invalidates or refreshes any profile-dependent local state used by the Account menu and authenticated API scoping.
- Compatibility route `/organization/profile` should redirect without rendering Organization tabs.

## Content Requirements

Primary labels:

- `Profile`
- `Account details`
- `Name`
- `Email`
- `Account type`
- `Save profile`
- `Password`
- `Current password`
- `New password`
- `Confirm new password`
- `Reset password`

Helper and state copy:

- `Manage your personal account details and local password.`
- `This identity is used for FeatBit notifications, audit trails, and account menus.`
- `Changes are saved to your user profile and reflected in the account menu.`
- `Available for local accounts only. SSO and social accounts do not reset passwords here.`
- `Minimum 6 characters`
- `Password is managed by your identity provider.`
- `Profile successfully updated`
- `Reset password success`
- `Reset password failed, reason: {reason}.`
- `Operation failed, please try again`
- `Operation failed`

## Implementation Notes For Later

- Use the shared authenticated API client for `/api/v1/user/profile` and `/api/v1/identity/reset-password`.
- Extend the stored profile type to include `origin` if the React implementation does not already persist it after login.
- Keep direct login-time profile loading as the existing authentication bootstrap exception, but page-level profile updates should use the shared API client.
- Split implementation by responsibility: route/page container, profile API hooks, account-details form, password form, and compatibility redirect.
- Use shadcn `Button`, `Input`, `Form`, `Badge`, `Skeleton`, `Tooltip`, and optional `Separator`/section primitives.
- Do not hand-edit generated `src/components/ui/*` files for this feature.
- Page must work in both `/en` and `/zh` routes.
- Add Playwright coverage for account-menu Profile navigation, profile update success, invalid email validation, local-user password section, non-local password omission, password mismatch validation, reset-password success clearing fields, backend reset failure reason, and `/organization/profile` redirect compatibility.
