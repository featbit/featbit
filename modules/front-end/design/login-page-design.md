# Login Page Design Contract

## Required Designs

Implementation must strictly follow these design images:

- Light theme: [login-page-concept.png](login-page-concept.png)
- Dark theme: [login-page-layout-dark.png](login-page-layout-dark.png)

These images are the required visual contract for the React login page. They are not optional references. Layout, hierarchy, spacing rhythm, color treatment, control styling, borders, and light/dark behavior should match the saved designs as closely as practical in the browser. The behavioral and availability requirements below take precedence over controls shown in a static image when the corresponding capability is absent or server-gated.

Related SSO page design: [sso-login-page-design.md](sso-login-page-design.md)

## Design Requirements

- Create a fully redesigned login page rather than copying the Angular login screen.
- Keep all authentication page elements from the current login concept while aligning the visual treatment with the authenticated React layout.
- Keep the page modern, structured, and quiet, with less card-like composition.
- Preserve the current Angular FeatBit brand logo style: dark charcoal symbol plus FeatBit wordmark.
- Make authentication the primary task while using the left side to express FeatBit's product category through feature release and rollout visuals.
- Avoid marketing-page composition, layout screenshots, dashboard previews, AI messaging, and decorative illustrations.

## Layout

- Use a top header with FeatBit logo on the left and language switcher on the right.
- Add a compact theme toggle icon button in the top-right header, immediately before the language switcher.
- Add a subtle horizontal divider between the header and main content.
- Split the main content into two areas with a subtle vertical divider.
- Left side contains the brand statement and an abstract release-path visual.
- Right side contains the login form in a structured column, not a floating card.
- Footer links should remain quiet and should not have a divider line.
- Privacy and Help must open the official FeatBit privacy page and documentation rather than unresolved local routes.

## Left Visual Direction

- Use a feature rollout / traffic split abstraction rather than product screenshots.
- The visual can include small route nodes, rollout cards, and status labels such as Beta users, Gradual rollout, Stable, and Monitoring.
- Keep the visual airy, with generous negative space.
- Do not add AI content, AI labels, robot/chat imagery, or AI assistant concepts.
- Do not reintroduce the bottom legend strip such as Rules / Traffic / Ready.

## Right Authentication Column

- Keep the form order:
  - Email
  - Password
  - Remember email
  - Sign in
  - Available Google / GitHub OAuth buttons
  - Enterprise sign-in section when SSO is enabled
  - Sign in with SSO when SSO is enabled
- Do not show a password-recovery link until a real unauthenticated recovery flow exists.
- `Remember email` only describes and controls whether the email address is prefilled on a future visit; it must not imply different session persistence.
- Google and GitHub should be grouped under `or continue with`.
- SSO should be visually separated under `Enterprise sign-in`; it should not look like a third social OAuth button.
- Only show the SSO section when `/api/v1/sso/pre-check` reports that SSO is enabled.
- While external options are loading or unavailable, show compact loading or retry feedback without blocking email/password sign-in.
- Do not include helper text under Enterprise sign-in.
- Clicking `Sign in with SSO` should navigate to or reveal the dedicated SSO flow described in [sso-login-page-design.md](sso-login-page-design.md).
- Do not place checkmark, success, verified, or tick icons in the right login area.

## Visual Style

- Use shadcn/ui and Tailwind defaults for controls as much as possible.
- Match the authenticated React layout visual language described in [react-layout-design.md](react-layout-design.md).
- The theme toggle should use a shadcn-style square outline icon button: moon icon in light theme, sun icon in dark theme.
- Light theme should use layout-like white and very light slate surfaces, crisp slate text, thin light borders, and blue primary actions.
- Dark theme should use neutral dark slate surfaces, light foreground text, muted slate secondary text, thin dark borders, and the same blue primary action language.
- Use small green, orange, and blue status accents only where they support the rollout visual.
- Avoid bright Angular green dominance, warm ivory/evergreen login-specific palettes, purple/blue gradient dominance, decorative blobs, bokeh, stock illustrations, and heavy shadows.
- Use subtle borders and layout dividers for structure.

## Implementation Notes

- The final implementation should be validated against the saved light and dark design images. Treat meaningful differences in layout, visual hierarchy, colors, borders, shadows, controls, and responsive behavior as implementation defects unless this document and the saved assets are updated first.
- Prefer CSS/SVG for the left abstract release-path graphic so it can be responsive and maintainable.
- Keep all text translatable through `react-i18next`.
- Ensure the layout works for both `/en/login` and `/zh/login`.
- Theme switching must be available before authentication and should share the same persisted `light` / `dark` / `system` theme behavior as the React layout.
- On smaller screens, collapse to a single-column login-first layout and hide or simplify the left visual.
- Keep the logo, theme control, and language switcher on one unclipped row at 320px and wider. Preserve the current query string and hash when switching languages.
