# 01 - Scaffold `front-end-react`

## Goal

Create the standalone React application foundation in `front-end-react` without modifying the existing Angular `front-end`.

## Decisions

- Use Vite + React + TypeScript as a static SPA.
- Use React Router in front-end SPA mode only.
- Use shadcn/ui + Radix primitives + Tailwind CSS as the UI foundation.
- Use TanStack Query for server state, TanStack Table for tables, React Hook Form + Zod for forms, Recharts for charts, CodeMirror 6 for embedded structured editing, and Shiki for code highlighting.
- Use `react-i18next` for i18n.
- Use Playwright as the browser E2E runner.

## Required Setup

- Create `front-end-react` as an independent package with its own `package.json`, `tsconfig`, Vite config, Tailwind config, ESLint config, test config, and README.
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
- No files in Angular `front-end` are modified.
