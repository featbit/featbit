# React + TypeScript + Vite + shadcn/ui

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Docker

Build the production image:

```bash
docker build -t featbit/front-end-v2 --build-arg VERSION=dev .
```

Run it with Nginx:

```bash
docker run --rm -p 8085:80 `
  -e API_URL=http://localhost:5000 `
  -e EVALUATION_URL=http://localhost:5100 `
  -e HOSTING_MODE=saas `
  featbit-front-end-v2:test
```

The container serves the Vite build from `/usr/share/nginx/featbit`, exposes
`/health`, supports `/en/*` and `/zh/*` SPA routes, and generates
`/assets/env.js` from runtime environment variables on startup. Supported
runtime keys are `API_URL`, `DEMO_URL`, `EVALUATION_URL`, `BASE_HREF`,
`DISPLAY_API_URL`, `DISPLAY_EVALUATION_URL`, `HOSTING_MODE`, and `VERSION`.

For sub-path hosting, set `BASE_HREF` without a trailing slash:

```bash
docker run --rm -p 8080:80 -e BASE_HREF=/featbit featbit/front-end-v2
```

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```
