# Login Page Design Direction

## Current Concept

Reference image: [login-page-concept.png](login-page-concept.png)

This concept is the current preferred direction for the React login page. It should be treated as a design reference, not a pixel-perfect implementation requirement.

Related SSO page design: [sso-login-page-design.md](sso-login-page-design.md)

## Design Intent

- Create a fully redesigned login page rather than copying the Angular login screen.
- Keep the page modern, structured, and quiet, with less card-like composition.
- Preserve the current Angular FeatBit brand logo style: dark charcoal symbol plus FeatBit wordmark.
- Make authentication the primary task while using the left side to express FeatBit's product category through feature release and rollout visuals.
- Avoid marketing-page composition, console screenshots, dashboard previews, AI messaging, and decorative illustrations.

## Layout

- Use a top header with FeatBit logo on the left and language switcher on the right.
- Add a subtle horizontal divider between the header and main content.
- Split the main content into two areas with a subtle vertical divider.
- Left side contains the brand statement and an abstract release-path visual.
- Right side contains the login form in a structured column, not a floating card.
- Footer links should remain quiet and should not have a divider line.

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
  - Remember me / Forgot password
  - Sign in
  - Google / GitHub OAuth buttons
  - Enterprise sign-in section
  - Sign in with SSO
- Google and GitHub should be grouped under `or continue with`.
- SSO should be visually separated under `Enterprise sign-in`; it should not look like a third social OAuth button.
- Do not include helper text under Enterprise sign-in.
- Clicking `Sign in with SSO` should navigate to or reveal the dedicated SSO flow described in [sso-login-page-design.md](sso-login-page-design.md).
- Do not place checkmark, success, verified, or tick icons in the right login area.

## Visual Style

- Use shadcn/ui and Tailwind defaults for controls as much as possible.
- Preferred palette: warm ivory background, deep ink text, muted evergreen accent, pale mint surfaces, graphite dividers, sparse amber highlights.
- Avoid bright Angular green dominance, purple/blue gradient dominance, decorative blobs, bokeh, stock illustrations, and heavy shadows.
- Use subtle borders and layout dividers for structure.

## Implementation Notes

- The final implementation does not need to match the generated image pixel-for-pixel.
- Prefer CSS/SVG for the left abstract release-path graphic so it can be responsive and maintainable.
- Keep all text translatable through `react-i18next`.
- Ensure the layout works for both `/en/login` and `/zh/login`.
- On smaller screens, collapse to a single-column login-first layout and hide or simplify the left visual.
