# 07 - Deployment And Documentation

## Goal

Prepare the React front-end for local development, production build, Docker/Nginx deployment, environment configuration, and future cutover from Angular.

## Docker And Nginx

- Add a React-specific Dockerfile that builds the Vite app and serves static assets through Nginx.
- Deploy build output to `/usr/share/nginx/featbit`.
- Preserve `/health`.
- Preserve `/en/*` and `/zh/*` SPA fallback behavior.
- Preserve `BASE_HREF` handling if the current deployment still needs it.
- Preserve runtime `env.template.js` to `env.js` generation behavior.

## Runtime Env

- Document all supported runtime keys:
  - `API_URL`
  - `DEMO_URL`
  - `EVALUATION_URL`
  - `DISPLAY_API_URL`
  - `DISPLAY_EVALUATION_URL`
  - `HOSTING_MODE`
- Provide local development examples and production examples.
- Explain which values are used by management API calls and which are displayed to users.

## Scripts

- Document:
  - install
  - dev
  - build
  - preview
  - lint
  - typecheck
  - unit tests
  - component tests
  - Playwright E2E
  - Testcontainers E2E
  - Docker image build

## Testcontainers E2E Documentation

- Explain that default real-stack integration tests require Docker.
- Default stack is Postgres + api-server only.
- Document image override env vars:
  - `FEATBIT_API_IMAGE`
  - `FEATBIT_POSTGRES_IMAGE`
- Explain that evaluation-server is not part of the default integration stack.

## Cutover Notes

- Keep Angular and React deployments parallel until parity is accepted.
- Do not change external docker-compose or release entry points until React parity is verified.
- Define a later cutover checklist for routing, Docker image names, docs, and rollback.

## Acceptance Criteria

- A developer can run the React app locally from README instructions.
- Production Docker image can be built and served with Nginx.
- `/health`, `/en/*`, `/zh/*`, and runtime env generation work in the built image.
- Documentation clearly states what is still parallel-only and what is ready for cutover.
