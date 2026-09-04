# Auth & Security Model — release-decision-web

`release-decision-web` is a browser-only React + Vite SPA.

The app uses the same browser-side FeatBit auth state as the main Angular UI:

- JWT access token: `localStorage.token`
- refresh flow: FeatBit API `/identity/refresh-token`
- organization/workspace context: `Organization` and `Workspace` headers from `authStorage`

All runtime experiment reads, writes, MCP token operations, and analysis requests go through the FeatBit API. Do not add frontend API routes, server actions, frontend Prisma access, or browser-visible signing keys in this package.

If a feature needs server-side behavior, implement it in `modules/back-end` and call that API from the SPA through `src/lib/featbit-auth/http.ts`.
