# FeatBit React Front-End

Standalone React implementation for the FeatBit management console.

## Stack

- Vite SPA with React and TypeScript
- React Router in browser SPA mode
- Tailwind CSS and shadcn/ui-style components
- TanStack Query and TanStack Table
- React Hook Form and Zod
- react-i18next
- Recharts, CodeMirror 6, and Shiki
- Vitest and Playwright

## Dependency Policy

Dependencies are declared with npm's default caret ranges in `package.json` and resolved exactly in `package-lock.json`. Do not use prerelease versions marked `rc`, `alpha`, `beta`, `next`, `canary`, or `experimental`.

The project targets the latest stable LTS-compatible Node.js runtime available at implementation time. The local scaffold was created on Node.js `v24.17.0`; Node type definitions are pinned to the Node 24 line for LTS compatibility rather than the newer non-LTS `@types/node@latest` line. If a future dependency requires a newer non-LTS runtime, choose the newest mutually compatible stable version and document the reason here.

## Commands

```powershell
npm install
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
npm run test:e2e:containers
```

If `node_modules` was created by a failed install, remove it manually before reinstalling dependencies. This repository's agent instructions prohibit automated bulk deletion.

`npm run test:e2e:containers` starts a Testcontainers stack with Postgres and the FeatBit API server before running Playwright. Override the pinned defaults with `FEATBIT_E2E_POSTGRES_IMAGE` and `FEATBIT_E2E_API_IMAGE` when needed.

## Runtime Configuration

Runtime environment values are read from `public/assets/env.js`. The production image should generate it from `public/assets/env.template.js`.

Supported keys:

- `API_URL`
- `DEMO_URL`
- `EVALUATION_URL`
- `DISPLAY_API_URL`
- `DISPLAY_EVALUATION_URL`
- `HOSTING_MODE`
- `VERSION`

`VERSION` defaults to `dev`.
