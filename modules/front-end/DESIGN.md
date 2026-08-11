---
name: FeatBit React Front End
description: A professional desktop workbench for feature management workflows.
colors:
  background: "#ffffff"
  foreground: "#18181b"
  card: "#ffffff"
  popover: "#ffffff"
  primary: "#27272a"
  primary-foreground: "#fafafa"
  secondary: "#f4f4f5"
  secondary-foreground: "#27272a"
  muted: "#f4f4f5"
  muted-foreground: "#71717a"
  accent: "#f4f4f5"
  accent-foreground: "#27272a"
  destructive: "#dc2626"
  border: "#e4e4e7"
  input: "#e4e4e7"
  ring: "#a1a1aa"
  dark-background: "#18181b"
  dark-foreground: "#fafafa"
  dark-card: "#27272a"
  dark-muted: "#3f3f46"
  dark-border: "#ffffff1a"
typography:
  display:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  headline:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  title:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "normal"
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  input-default:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "4px 10px"
  badge-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "9999px"
    height: "20px"
    padding: "2px 8px"
---

# Design System: FeatBit React Front End

## 1. Overview

**Creative North Star: "The Release Workbench"**

FeatBit's React interface is a professional desktop workbench for developers, PMs, release managers, and operators who manage feature flags, rollout risk, workspace settings, billing state, and identity configuration. The design serves the task: compact information, obvious context, familiar controls, and clear status feedback.

The system uses shadcn/ui base-nova with Tailwind CSS variables, Base UI primitives, lucide-react icons, and Inter Variable. It should feel friendly enough to guide a team through setup and recovery paths, but never like a marketing page. Product pages are desktop-first and should preserve a low-noise, operational rhythm.

The visual language rejects Angular/ng-zorro cloning, large FeatBit-green surfaces, decorative SaaS gloss, dashboard screenshots as decoration, AI-themed messaging, and cellphone-first polish unless explicitly requested.

**Key Characteristics:**
- Compact desktop density with generous enough spacing for repeated daily use.
- Neutral shadcn surfaces with rare brand accent moments.
- Bordered and tonal hierarchy instead of heavy shadows.
- Familiar controls before custom invention.
- Visible risk and status near the action they affect.

## 2. Colors

The palette is a restrained neutral workbench: shadcn neutral tokens carry the product surface, while FeatBit brand color stays mostly in the logo and rare accents.

### Primary
- **Workbench Ink** (`--primary`, `--foreground`): the primary action and text family. Use it for primary buttons, high-emphasis text, and current command surfaces.

### Neutral
- **Clean Canvas** (`--background`, `--card`, `--popover`): white and near-white surfaces for primary content areas.
- **Quiet Panel** (`--muted`, `--secondary`, `--accent`): near-white neutral layers for toolbars, inactive controls, row hovers, and low-emphasis panels.
- **Divider Line** (`--border`, `--input`): thin neutral borders for sections, fields, tabs, and table boundaries.
- **Muted Copy** (`--muted-foreground`): secondary text and helper copy. Keep it on neutral backgrounds only.
- **Dark Workbench** (`.dark --background`, `.dark --card`, `.dark --muted`): neutral dark surfaces, not pure black, with the same information hierarchy as light mode.
- **Destructive Red** (`--destructive`): destructive actions and validation errors only. Do not use it as decorative urgency.

### Named Rules

**The Neutral-First Rule.** Product surfaces start from shadcn neutral tokens. If a screen feels branded because of large green fields or saturated accents, it has drifted.

**The Rare Brand Rule.** FeatBit brand color belongs in the mark, logo, and occasional brand accents, not in the default action system.

## 3. Typography

**Display Font:** Inter Variable, sans-serif  
**Body Font:** Inter Variable, sans-serif  
**Label/Mono Font:** Inter Variable for labels; use code/mono only for keys, snippets, and developer artifacts when a local component requires it.

**Character:** Inter gives FeatBit a practical, contemporary product voice. The type scale is compact and fixed, with no display-font drama inside authenticated workflows.

### Hierarchy
- **Display** (600, 24px, 1.25): page titles such as Workspace. Keep it restrained and single-line when possible.
- **Headline** (600, 18px, 1.35): section headings such as Access configuration.
- **Title** (500-600, 16px, 1.375): card titles, drawer titles, compact panel headings, and table-group headings.
- **Body** (400, 14px, 1.5): form helper copy, table cells, descriptions, and standard product prose.
- **Label** (500, 14px, normal letter spacing): field labels, button labels, tabs, and compact metadata.

### Named Rules

**The No-Display-Drama Rule.** Authenticated product UI uses one sans family and a tight scale. Do not introduce decorative display typography into settings, tables, builders, or dashboards.

## 4. Elevation

FeatBit is flat by default. Depth is conveyed through borders, tonal layers, sticky layout structure, and focus rings rather than ambient card shadows. Cards use a one-pixel ring and tonal footers; headers and sidebars rely on borders.

### Shadow Vocabulary
- **None at rest** (`box-shadow: none`): default for cards, forms, tables, and workspace panels.
- **Focus ring** (`ring-3 ring-ring/50`): interactive focus treatment inherited from shadcn controls.

### Named Rules

**The Bordered Workbench Rule.** Use thin borders and tonal layers before shadows. If an element needs a wide blur to feel important, its hierarchy is wrong.

## 5. Components

### Buttons
- **Shape:** gently rounded rectangles (10px radius through `rounded-lg`).
- **Primary:** dark neutral fill with light text (`--primary` / `--primary-foreground`), 32px default height, compact horizontal padding.
- **Hover / Focus:** hover darkens or tones the fill; focus uses the shadcn ring. Do not add custom glow or decorative shadows.
- **Secondary / Ghost / Outline:** use shadcn variants. Outline buttons stay bordered and neutral; ghost buttons are for icon and low-emphasis actions.

### Chips
- **Style:** use `Badge` variants. Outline badges are bordered and neutral; destructive badges are reserved for destructive or expired states.
- **State:** badges should communicate status, license gating, or compact metadata. Do not invent local badge components when the shared Badge works.

### Selects
- **Required composition:** every shadcn/Base UI `Select` must render its options inside `SelectContent > SelectGroup > SelectItem`. This requirement also applies when the select contains only one logical group and does not display a group label.
- **Do not** render `SelectItem` directly under `SelectContent`. Omitting `SelectGroup` changes the expected option padding/group semantics and can cause the popup to appear misaligned with the trigger.
- **Reference implementation:** follow `OrganizationSelect` in `front-end/src/features/organization/general/components/organization-form-fields.tsx`.

```tsx
<Select value={value} onValueChange={onValueChange}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectItem value="first">First option</SelectItem>
      <SelectItem value="second">Second option</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

### Cards / Containers
- **Corner Style:** softly rounded (14px for cards, 10px or less for most controls).
- **Background:** `--card` or `--background`; secondary areas use `--muted/50` or `--muted/30`.
- **Shadow Strategy:** no ambient shadows at rest. Use borders/rings.
- **Border:** one-pixel neutral ring or border.
- **Internal Padding:** 12-20px depending on density; repeated data surfaces should stay compact.

### Inputs / Fields
- **Style:** 32px height, 10px horizontal padding, neutral border, transparent/light background.
- **Focus:** shadcn border and ring treatment.
- **Error / Disabled:** use built-in invalid and disabled states. Do not add extra accessibility-specific wiring unless explicitly requested or required by the component primitive.

### Navigation
- **Style:** left product sidebar plus top context bar. The sidebar uses compact icon+label rows, muted text at rest, and neutral active/hover states.
- **Authenticated header:** only the Organization / Project / Environment context and compact subscription/license badge belong in the top bar.
- **Desktop priority:** authenticated navigation is designed for desktop-class screens. Do not optimize for cellphone use unless explicitly requested.

### Signature Component: Workspace Shell

The workspace shell uses a simple page header, workspace key subtitle, tab row, and full-width settings/usage/license content. It should feel like a settings workbench: direct fields, visible save actions, and clear gated states.

## 6. Do's and Don'ts

### Do:
- **Do** use shadcn/ui and Base UI primitives for standard controls before writing custom UI.
- **Do** keep product pages compact, neutral, and task-oriented.
- **Do** preserve the left sidebar, top context bar, and Workspace tab patterns for authenticated surfaces.
- **Do** use lucide-react icons at the established 16-20px scale.
- **Do** keep light and dark themes structurally equivalent.
- **Do** show risk, license, expired, pending, destructive, and gated states near the action they affect.
- **Do** design authenticated product pages for professional desktop workflows first.

### Don't:
- **Don't** recreate the Angular/ng-zorro visual system one-to-one, including its old green-dominant palette, legacy spacing, or control styling.
- **Don't** copy the old Angular login background or old illustration card.
- **Don't** use marketing-page composition inside authenticated product pages: oversized hero sections, decorative card-heavy layouts, gratuitous motion, layout screenshots as decoration, AI-themed messaging, or large areas of brand color.
- **Don't** hide operational state behind generic SaaS gloss. Feature flags, targeting, billing/license state, IAM, audit logs, and workspace settings must expose risk, context, and next actions directly.
- **Don't** optimize authenticated product pages for cellphone use unless explicitly requested.
- **Don't** add extra accessibility-specific wiring such as `aria-describedby`, alert roles, or screen-reader-only helper copy unless explicitly requested or required for component function.
- **Don't** create one-off badges, buttons, inputs, or cards when a shared shadcn component already covers the need.
- **Don't** use heavy shadows, glass effects, side-stripe borders, gradient text, decorative grid backgrounds, or large rounded cards as default product styling.
