# SSO Login Page Design Contract

## Required Designs

Implementation must strictly follow these design images:

- Light theme: [sso-login-page-concept.png](sso-login-page-concept.png)
- Dark theme: [sso-login-page-layout-dark.png](sso-login-page-layout-dark.png)

These images are the required visual contract for the SSO login page after clicking `Sign in with SSO` from the main login page. They are not optional references. Layout, hierarchy, spacing rhythm, color treatment, control styling, borders, and light/dark behavior should match the saved designs as closely as practical in the browser. The availability, validation, and recovery requirements below take precedence over a static image.

Related design: [login-page-design.md](login-page-design.md)

## Design Requirements

- Keep the same structured split layout as the main login page.
- Keep all SSO page elements from the current concept while aligning the visual treatment with the authenticated React layout.
- Make the SSO flow focused and minimal.
- Ask for `Workspace key`, not workspace domain.
- Keep `Back to sign in` as the only way back to the normal login flow.
- Avoid extra explanatory helper links or protocol details.
- Guard both the main-page SSO entry and the dedicated route with `/api/v1/sso/pre-check`.

## Layout

- Use the same header as the main login page:
  - Angular-style FeatBit logo on the left.
  - theme toggle icon button in the top-right header, immediately before the language switcher.
  - language switcher on the right.
  - subtle horizontal divider below the header.
- Use the same main split:
  - left feature rollout / traffic split visual.
  - right SSO authentication column.
  - subtle vertical divider between left and right.
- Footer should only contain quiet `Privacy` and `Help` links and should not have a divider line.
- Privacy and Help must open the official FeatBit privacy page and documentation rather than unresolved local routes.

## Left Visual Direction

- Match the main login page's feature rollout abstraction.
- Keep rollout nodes, route cards, and status labels such as Beta users, Gradual rollout, Stable, and Monitoring.
- Do not add AI content.
- Do not add layout previews, dashboard tables, charts, or sidebars.
- Do not reintroduce the bottom `Rules / Traffic / Ready` legend strip.

## Right SSO Column

- Keep the SSO form order:
  - Back to sign in
  - Sign in with SSO
  - Guidance that the workspace key is provided by an administrator
  - Workspace key
  - input placeholder such as `acme-prod`
  - Continue with SSO
- Do not include Google or GitHub buttons on this page.
- Do not include email/password inputs on this page.
- Do not include `Use email and password instead`.
- Do not include `SAML and OIDC supported` or any protocol support note.
- Do not place checkmark, success, verified, or tick icons in the right authentication area.
- Show a focused availability-check state before rendering the form. If the check fails, provide Retry and Back to sign in actions.
- If SSO is disabled, replace the dedicated route with the localized email login route and explain why.
- If the deployment provides a workspace key, render it as readable, non-editable configuration rather than as a disabled field.
- Show missing-key validation directly under the field, mark the field invalid, and return focus to it.
- After Continue with SSO is submitted, disable the button and communicate the redirect in progress.

## Visual Style

- Reuse the main login page visual system and keep it aligned with [react-layout-design.md](react-layout-design.md).
- The theme toggle should use a shadcn-style square outline icon button: moon icon in light theme, sun icon in dark theme.
- Light theme should use layout-like white and very light slate surfaces, crisp slate text, thin light borders, and blue primary actions.
- Dark theme should use neutral dark slate surfaces, light foreground text, muted slate secondary text, thin dark borders, and the same blue primary action language.
- Use small green, orange, and blue status accents only where they support the rollout visual.
- Use shadcn/ui and Tailwind defaults for input and button styling.
- Keep dividers subtle but visible.
- Avoid warm ivory/evergreen login-specific palettes, floating cards, heavy shadows, decorative blobs, bokeh, stock illustration, and old Angular/ng-zorro styling.

## Implementation Notes

- The final implementation should be validated against the saved light and dark design images. Treat meaningful differences in layout, visual hierarchy, colors, borders, shadows, controls, and responsive behavior as implementation defects unless this document and the saved assets are updated first.
- The SSO page should be a dedicated route or state under the login flow, for example `/en/login/sso` and `/zh/login/sso`, or an equivalent route chosen during implementation.
- The `Workspace key` field should be validated as required before continuing.
- OAuth/SSO callbacks should replace the active form with a dedicated completion state and expose only a localized safe error if completion fails.
- Keep all text translatable through `react-i18next`.
- Theme switching must be available before authentication and should share the same persisted `light` / `dark` / `system` theme behavior as the React layout.
- On smaller screens, collapse to a single-column SSO-first layout and hide or simplify the left visual.
- Keep the logo, theme control, and language switcher on one unclipped row at 320px and wider. Preserve callback and reason parameters when switching languages.
