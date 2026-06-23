# SSO Login Page Design Direction

## Current Concept

Reference image: [sso-login-page-concept.png](sso-login-page-concept.png)

This concept shows the page after clicking `Sign in with SSO` from the main login page. It should use the same visual system as the main login page and should feel like the same authentication flow.

Related design: [login-page-design.md](login-page-design.md)

## Design Intent

- Keep the same structured split layout as the main login page.
- Make the SSO flow focused and minimal.
- Ask for `Workspace key`, not workspace domain.
- Keep `Back to sign in` as the only way back to the normal login flow.
- Avoid extra explanatory helper links or protocol details.

## Layout

- Use the same header as the main login page:
  - Angular-style FeatBit logo on the left.
  - language switcher on the right.
  - subtle horizontal divider below the header.
- Use the same main split:
  - left feature rollout / traffic split visual.
  - right SSO authentication column.
  - subtle vertical divider between left and right.
- Footer should only contain quiet `Privacy` and `Help` links and should not have a divider line.

## Left Visual Direction

- Match the main login page's feature rollout abstraction.
- Keep rollout nodes, route cards, and status labels such as Beta users, Gradual rollout, Stable, and Monitoring.
- Do not add AI content.
- Do not add console previews, dashboard tables, charts, or sidebars.
- Do not reintroduce the bottom `Rules / Traffic / Ready` legend strip.

## Right SSO Column

- Keep the SSO form order:
  - Back to sign in
  - Sign in with SSO
  - Enter your workspace key to continue
  - Workspace key
  - input placeholder such as `acme-prod`
  - Continue with SSO
- Do not include Google or GitHub buttons on this page.
- Do not include email/password inputs on this page.
- Do not include `Use email and password instead`.
- Do not include `SAML and OIDC supported` or any protocol support note.
- Do not place checkmark, success, verified, or tick icons in the right authentication area.

## Visual Style

- Reuse the main login page palette: warm ivory background, deep ink text, muted evergreen accent, pale mint surfaces, graphite dividers, sparse amber highlights.
- Use shadcn/ui and Tailwind defaults for input and button styling.
- Keep dividers subtle but visible.
- Avoid floating cards, heavy shadows, decorative blobs, bokeh, stock illustration, and old Angular/ng-zorro styling.

## Implementation Notes

- The SSO page should be a dedicated route or state under the login flow, for example `/en/login/sso` and `/zh/login/sso`, or an equivalent route chosen during implementation.
- The `Workspace key` field should be validated as required before continuing.
- Keep all text translatable through `react-i18next`.
- On smaller screens, collapse to a single-column SSO-first layout and hide or simplify the left visual.
