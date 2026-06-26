# 01 - Scaffold `front-end-react`

## Goal

Create the standalone React application foundation in `front-end-react` without modifying the existing Angular `front-end`.

## Decisions

- Use Vite + React + TypeScript as a static SPA.
- Use React Router in front-end SPA mode only.
- Use shadcn/ui + Radix primitives + Tailwind CSS as the UI foundation.
- Support light/dark/system theme modes from the first scaffold using shadcn's native dark-mode pattern for Vite.
- Use TanStack Query for server state, TanStack Table for tables, React Hook Form + Zod for forms, Recharts for charts, CodeMirror 6 for embedded structured editing, and Shiki for code highlighting.
- Use `react-i18next` for i18n.
- Use Playwright as the browser E2E runner.

## Step Scope

This document defines migration step 1: project initialization. When the user asks to execute only step 1, scaffold and verify the React project foundation only. Do not build the final login page, authenticated layout, or feature pages as part of this step.

## Dependency Version Policy

- Use the latest stable LTS-compatible versions available at implementation time for runtime and tooling dependencies.
- For platforms with an LTS concept, such as Node.js, use the latest active or maintenance LTS line rather than a current experimental line.
- For packages without an LTS concept, use the latest stable release that is compatible with the selected LTS runtime and the rest of the stack.
- Do not use prerelease channels or versions marked `rc`, `alpha`, `beta`, `next`, `canary`, or `experimental`.
- Prefer exact or lockfile-pinned resolved versions after installation so repeat installs are deterministic.
- If the latest stable version conflicts with another required package, choose the newest mutually compatible stable version and document the reason in `front-end-react/README.md`.

## Required Setup

- Create `front-end-react` as an independent package with its own `package.json`, `tsconfig`, Vite config, Tailwind config, ESLint config, test config, and README.
- Configure Tailwind dark mode using shadcn's `darkMode: ["class"]` strategy and the standard shadcn CSS variables for background, foreground, card, popover, border, muted, primary, destructive, ring, and chart colors.
- Add the shadcn-style `ThemeProvider` and `useTheme` helper for Vite. It should support `light`, `dark`, and `system`, persist the selected preference in local storage, and apply the theme class before app paint where possible to avoid theme flash.
- Keep shadcn's default color variables as the baseline. Extend CSS variables only when a product-specific semantic need cannot be expressed with shadcn defaults, and do not use the Angular color scheme as the React palette. Do not introduce a separate custom theme framework.
- Configure path aliases, at minimum:
  - `@/app`
  - `@/assets`
  - `@/components`
  - `@/features`
  - `@/lib`
  - `@/routes`
  - `@/stores`
  - `@/test`
- Add scripts:
  - `dev`
  - `build`
  - `preview`
  - `lint`
  - `test`
  - `test:component`
  - `test:e2e`
  - `test:e2e:containers`
  - `typecheck`
- Configure Vite to build a static SPA compatible with Nginx fallback for `/en/*` and `/zh/*`.
- Add the runtime env typing for `window.env` and the supported keys:
  - `API_URL`
  - `DEMO_URL`
  - `EVALUATION_URL`
  - `DISPLAY_API_URL`
  - `DISPLAY_EVALUATION_URL`
  - `HOSTING_MODE`
  - `VERSION`

## Directory Structure

Use this baseline layout:

```text
front-end-react/
  public/
    assets/
  src/
    app/
    assets/
    components/
      ui/
      common/
      layout/
    features/
    lib/
      api/
      auth/
      env/
      i18n/
      permissions/
      theme/
      test/
    routes/
    stores/
    styles/
    test/
```

## Acceptance Criteria

- `npm run dev` starts the React SPA.
- `npm run build` produces static assets.
- The app can render placeholder `/en/login`, `/zh/login`, and authenticated layout routes.
- Tailwind and shadcn/ui components render correctly.
- Light, dark, and system theme modes can be selected and persist across reloads.
- Runtime env typing includes `VERSION`, and the app can read `window.env.version` with a `dev` fallback.
- No files in Angular `front-end` are modified.
