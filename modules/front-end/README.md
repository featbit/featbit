<h1 align="center">FeatBit UI</h1>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/featbit/featbit.svg?style=flat&logo=github&colorB=red&label=stars)](https://github.com/featbit/featbit)
[![Node.js](https://img.shields.io/badge/Node.js-22.19-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

FeatBit UI is the management portal for FeatBit. It provides interfaces for managing feature flags, users, segments, change requests, permissions, organizations, audit logs, and other FeatBit resources.

The application is built with React, TypeScript, and Vite.

## Quick start with Docker Compose

The recommended way to run the UI together with the FeatBit services is from the repository root:

```sh
docker compose up -d
```

Open <http://localhost:8081> after the containers are ready.

## Local development

### Prerequisites

- Node.js 22.19 or a version supported by the current Vite release
- A running FeatBit API server
- A running Evaluation server if you want to use evaluation or demo features

### Install and run

From the repository root:

```sh
cd modules/front-end
npm ci
npm run dev
```

The development server is available at <http://localhost:5173>.

## Environment variables

The UI reads its environment-specific settings from `assets/env.js`. Service URLs must be reachable from the user's browser; they are not container-to-container addresses.

### Application defaults

The application uses the following defaults when a runtime value is missing or empty. For local development, edit [`public/assets/env.js`](public/assets/env.js) to override them:

```js
window.env = window.env || {
  API_URL: "http://localhost:5000",
  DEMO_URL: "https://featbit-samples.vercel.app",
  EVALUATION_URL: "http://localhost:5100",
  BASE_HREF: "",
  DISPLAY_API_URL: "",
  DISPLAY_EVALUATION_URL: "",
  HOSTING_MODE: "self-hosted",
  VERSION: "dev"
}
```

### Docker container configuration

The Docker image generates `assets/env.js` from container environment variables when it starts. Empty or unset values fall back to the application defaults, while supplied values override them. The `VERSION` build argument is still injected as image metadata and defaults to `dev`.

| Variable | Required | Application default | Description |
| --- | --- | --- | --- |
| `API_URL` | Yes | `http://localhost:5000` | URL of the FeatBit API server used by the browser. |
| `DEMO_URL` | No | `https://featbit-samples.vercel.app` | URL of the interactive demo. The UI adds the parameters needed by the demo. |
| `EVALUATION_URL` | No | `http://localhost:5100` | URL of the Evaluation server used by evaluation and demo features. |
| `BASE_HREF` | No | Empty | URL path under which the UI is served. For example, both `featbit` and `/featbit/` are normalized to `/featbit`. |
| `DISPLAY_API_URL` | No | Empty | API URL shown in the Getting Started page when it differs from `API_URL`. |
| `DISPLAY_EVALUATION_URL` | No | Empty | Event and streaming URL shown in the Getting Started page when it differs from `EVALUATION_URL`. |
| `HOSTING_MODE` | No | `self-hosted` | UI hosting mode. Use `saas` for hosted-only behavior. |
| `VERSION` | No | `dev` | Version displayed by the UI. |

These URL defaults are resolved by the user's browser. They work when the API and Evaluation server expose ports `5000` and `5100` on the same host as the UI. Override them when users access FeatBit through another hostname, port, or reverse proxy.

## Docker

### Build from source

Run the build from the repository root so the Docker context points to this module:

```sh
docker build -t featbit/ui:local ./modules/front-end
```

To include a version label:

```sh
docker build --build-arg VERSION=dev -t featbit/ui:local ./modules/front-end
```

Run the image:

```sh
docker run -d --name featbit-ui -p 8081:80 \
  -e API_URL="http://localhost:5000" \
  -e DEMO_URL="https://featbit-samples.vercel.app" \
  -e EVALUATION_URL="http://localhost:5100" \
  -e HOSTING_MODE="self-hosted" \
  featbit/ui:local
```

### Use the prebuilt image

```sh
docker run -d --name featbit-ui -p 8081:80 \
  -e API_URL="http://localhost:5000" \
  -e DEMO_URL="https://featbit-samples.vercel.app" \
  -e EVALUATION_URL="http://localhost:5100" \
  -e HOSTING_MODE="self-hosted" \
  featbit/featbit-ui:latest
```

Open <http://localhost:8081> after the container starts.

## Common commands

Run these commands from `modules/front-end`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check and create a production build. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run the Vitest test suite. |
| `npm run test:e2e` | Run end-to-end tests. |
| `npm run test:e2e:containers` | Build the API and frontend from source, then run container end-to-end tests. |
| `npm run test:nginx` | Test the production Nginx image behavior. |

## Container E2E and CI

The `Build and Test Frontend` GitHub Actions workflow runs Vitest and container E2E
tests for pull requests to `main`, pushes to `main`, and manual runs. Changes to
the frontend, API, or PostgreSQL initialization scripts trigger it.

`npm run test:e2e:containers` builds both application images from source using
`modules/back-end/deploy/Dockerfile` and `modules/front-end/Dockerfile`. The frontend
Dockerfile runs `npm run build`, and Playwright tests the production files served
by Nginx. Local runs and CI use this same command. Each run builds uniquely tagged
images and removes those test images after stopping the containers; Docker build
cache can be reused on subsequent runs. PostgreSQL uses `postgres:16-alpine`,
initialized with the repository's versioned SQL scripts and backend integration
fixture `Fixtures/vNext.sql` for schema changes in the current source tree; this
fixture is test-only and is not a production migration.

To run the stack locally, start Docker with its CLI available and run this command
from `modules/front-end`:

```sh
npm run test:e2e:containers
```

No image-selection or schema environment variables are required. The script
passes the dynamically assigned API and frontend URLs to Playwright internally.
`FEATBIT_E2E_POSTGRES_IMAGE` can still override the PostgreSQL image.

The terminal shows build/startup progress and Playwright results. Detailed build
and container logs are saved under `logs/e2e-containers/<run-id>/`, with the path
printed at the end. Build or container startup failures also print a bounded tail
of the relevant log. Test assertion failures keep the normal Playwright output
without dumping container logs.

The container smoke test checks that the frontend loads its actual runtime API
URL and can reach API readiness and the database-backed SSO pre-check from the
browser without mocks. The suite also includes mocked browser tests; starting
containers does not turn those tests into real API integration tests. CI uploads
the Playwright HTML report, failure traces, and diagnostic logs as
`frontend-e2e-results`.
