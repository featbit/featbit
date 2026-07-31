# Product

## Register

product

## Users

FeatBit is used by professional software teams managing feature releases, experiments, and operational risk across organizations, projects, and environments. Primary users include developers, product managers, product engineers, platform teams, release managers, administrators, and operators who need to change behavior safely while keeping enough context to understand impact.

Users often arrive in the middle of a workflow on desktop or laptop screens: finding a flag, checking rollout status, editing targeting rules, reviewing usage or license state, importing users, managing workspace settings, or auditing prior changes. They need dense but legible screens, predictable controls, and confidence that actions affect the intended environment.

## Product Purpose

The React front end in `front-end-v2` is a parallel replacement for the existing Angular management UI. It exists to modernize FeatBit's authenticated product experience while preserving backend contracts, language-prefixed routing, runtime configuration, and feature-management workflows.

Success means the React app feels like a capable feature-management workbench: clear context, low-noise density, visible risk and status, reliable light and dark themes, and reusable shadcn/Tailwind-based components that make future page migrations faster without copying Angular/ng-zorro styling.

## Brand Personality

Friendly SaaS: approachable, practical, and reassuring without becoming decorative or vague. The interface should feel helpful and modern, but still precise enough for release-management decisions where mistakes can affect production users.

The voice should be plainspoken and task-oriented. It can guide users through setup, empty states, and recovery paths, but routine screens should stay efficient and scannable.

## Anti-references

Do not recreate the Angular/ng-zorro visual system one-to-one, including its old green-dominant palette, legacy spacing, or control styling. The Angular app is a functional reference only.

Do not copy the old Angular login background or old illustration card. The React login experience should follow the saved design contracts in `design/login-page-design.md` and `design/sso-login-page-design.md`.

Avoid marketing-page composition inside the authenticated product: oversized hero sections, decorative card-heavy layouts, gratuitous motion, layout screenshots as decoration, AI-themed messaging, and large areas of brand color.

Avoid generic SaaS gloss that hides operational state. Feature flags, targeting, billing/license state, IAM, audit logs, and workspace settings should expose risk, context, and next actions directly.

Do not optimize authenticated product pages for cellphone use unless explicitly requested. FeatBit is a professional workbench for developers, PMs, and operators working on desktop-class screens.

## Design Principles

1. Keep context visible before action. Organization, project, environment, license state, and route location should be obvious when a user is about to change product behavior.
2. Make dense workflows calm. Tables, forms, drawers, and builders should be compact and scannable without feeling cramped.
3. Prefer familiar controls over invented affordances. Use shadcn/ui, Base UI primitives, Tailwind tokens, and lucide-react patterns unless FeatBit-specific behavior requires a composed wrapper.
4. Surface risk in place. Destructive, scheduled, gated, expired, pending, and environment-sensitive states should be visible near the action they affect.
5. Treat migration as redesign, not cloning. Preserve information architecture and backend behavior where needed, but let the React implementation establish its own modern product language.
6. Design for professional desktop workflows first. Do not spend polish effort on narrow mobile behavior unless the user asks for mobile support.

## Accessibility & Inclusion

Use the default accessibility behavior provided by shadcn/ui, Base UI primitives, semantic HTML, and browser-native controls. Do not add extra accessibility-specific wiring such as `aria-describedby`, alert roles, or screen-reader-only helper copy unless the user explicitly asks for that work or a component requires it to function correctly.

FeatBit is not designed as a disability-specific or assistive-technology-first product. Do not prioritize disability-specific UX accommodations during polish unless they are explicitly requested.

Light and dark themes must preserve the same information hierarchy. Motion should be brief and state-driven. Error, empty, loading, disabled, and gated states should provide clear visible text and recoverable next actions for the product's professional desktop audience.
