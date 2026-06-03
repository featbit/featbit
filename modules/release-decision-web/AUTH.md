# Auth & Security Model — modules/web

> Referenced from the top-level `AGENTS.md`. Agents and engineers should read
> this file when working on any route that touches authentication, agent tokens,
> or the FeatBit proxy.

---

## Overview

`modules/web` serves two caller types with different credentials:

| Caller | Credential | Guard functions |
|---|---|---|
| Browser (dashboard UI) | `fb_session` HttpOnly cookie | `requireAuth` |
| Local Claude Code agent (`sync.ts` via connector) | `Authorization: Bearer fbat_…` | `requireAuthOrAgent` / `requireAuthForExperiment` |

Both paths terminate at the same PostgreSQL database. There is no separate auth service.

---

## Identity source: FeatBit backend

All user identity comes from the FeatBit backend (`FEATBIT_API_URL`, default `https://app-api-experimentation.featbit.co`). Server-only env var — the URL is never sent to the browser, which always goes through the same-origin `/api/featbit-proxy` route.

- **Login** (`POST /api/auth/login`) — forwards credentials to FeatBit `/identity/login`, which returns a short-lived JWT plus refresh cookies.
- **Session storage** — the JWT and cookies are stored server-side in PostgreSQL (`AuthSession` table). The browser receives only an opaque `fb_session` HttpOnly cookie containing the session ID.
- **The FeatBit JWT never reaches the browser.** All FeatBit API calls are made server-side via `bridgeFetch` in `src/lib/server-auth/featbit-bridge.ts`, which attaches the JWT from the session row automatically.
- **Refresh** — `refreshIfNeeded` in `sessions.ts` auto-refreshes the FeatBit JWT via `/identity/refresh-token` when it is within 60 seconds of expiry. A singleflight map prevents concurrent refreshes per session.

### Organization header

FeatBit scopes many API responses (e.g. `/projects`) to the selected organization. The browser sends `Organization` and `Workspace` headers on every FeatBit proxy call, read from localStorage via `authStorage` in `src/lib/featbit-auth/http.ts`. Server-side routes that need to forward this context **must** read these headers from the incoming request (`req.headers.get("organization")`) rather than from `session.organizationId`, because the session field is not updated on org switch.

```ts
// Correct pattern (see agent-tokens/route.ts):
const orgId = req.headers.get("organization") ?? auth.organizationId ?? null;
const wsId  = req.headers.get("workspace")    ?? auth.workspaceId  ?? null;
await bridgeFetch("/projects", { token, organizationId: orgId, workspaceId: wsId });
```

---

## Session model

```
Browser
  │  Cookie: fb_session=<sessionId>  (HttpOnly, SameSite=Strict)
  ▼
Next.js API route  →  loadSessionById(sessionId)  →  PostgreSQL AuthSession row
  │
  ▼  ServerSession { id, token (FeatBit JWT), cookies, profile, workspaceId, organizationId }
  │
  ▼  bridgeFetch(path, { token, organizationId, workspaceId, ... })
  ▼
FeatBit backend  (app-api-experimentation.featbit.co)
```

**Intentionally unprotected auth routes** (public by design):

| Route | Reason |
|---|---|
| `POST /api/auth/login` | Creates the session |
| `POST /api/auth/logout` | Destroys the session cookie |
| `GET /api/auth/me` | Returns `{ profile: null }` for unauthenticated callers — safe introspection |
| `POST /api/auth/social-exchange` | OAuth callback handler |
| `POST /api/auth/sso-exchange` | SSO callback handler |

---

## Agent tokens (`AgentToken` table)

Per-project bearer tokens for headless callers — specifically the local Claude Code agent running `sync.ts` via the connector.

| Property | Detail |
|---|---|
| **Format** | `fbat_` + 32 base64url chars (192 bits entropy) |
| **Storage** | SHA-256 hash only — plaintext shown exactly once at issuance, never persisted |
| **Display prefix** | First 12 chars stored as `prefix` for UI identification (`fbat_abc123…`) |
| **Scope** | Per-project: each token is bound to a single `projectKey` |
| **Revocation** | Soft-delete via `revokedAt`; revoked tokens are immediately rejected |

### Issuance flow

1. User opens `/data/env-settings` → **Agent tokens** card
2. Types a label, clicks **Issue token**
3. `POST /api/agent-tokens` — server forwards the user's FeatBit JWT + `Organization`/`Workspace` headers to `bridgeFetch("/projects")` for an ACL check
4. If `projectKey` is in the returned project list, the token is minted; plaintext returned once in the response body
5. User copies the plaintext and sets `ACCESS_TOKEN=<plaintext>` in the shell before starting the connector

**If the check fails with "You do not have access to this project"**, the most common cause is a missing `Organization` header — the `AgentTokensCard` component must include `contextHeaders()` (org + workspace from localStorage) on every fetch call. See `src/components/env-settings/agent-tokens-card.tsx`.

### Revocation

```
DELETE /api/agent-tokens/[id]
```
Sets `revokedAt = now()`. Subsequent requests using that token get a 401.

---

## Guard functions (`src/lib/server-auth/guard.ts`)

| Function | Accepts | Returns | Use for |
|---|---|---|---|
| `requireAuth()` | Browser session only | `ServerSession \| 401` | Routes that must be browser-authenticated |
| `requireAuthOrAgent(req)` | Session OR agent bearer | `AuthContext \| 401` | Routes callable from both browser and agent |
| `requireAuthForExperiment(req, experimentId)` | Session OR agent bearer, with project scope check | `AuthContext \| 401/403` | Experiment-scoped writes that agents can make |

`AuthContext` is a discriminated union:
```ts
type AuthContext =
  | { kind: "session"; session: ServerSession }
  | { kind: "agent";   tokenId: string; projectKey: string }
```

When `kind === "agent"`, `requireAuthForExperiment` fetches the experiment's `featbitProjectKey` from PostgreSQL and returns 403 if it does not match the token's `projectKey`. Session callers skip this check — FeatBit backend enforces ACL for them.

---

## Route protection map

| Route | HTTP methods | Guard |
|---|---|---|
| `/api/auth/*` | (various) | None — public by design |
| `/api/featbit-proxy/[...path]` | GET POST PUT PATCH DELETE | None — see proxy note |
| `/api/experiments/[id]` | GET, PUT | `requireAuthForExperiment` |
| `/api/experiments/[id]/activity` | POST | `requireAuthForExperiment` |
| `/api/experiments/[id]/stage` | PUT | `requireAuthForExperiment` |
| `/api/experiments/[id]/state` | PUT | `requireAuthForExperiment` |
| `/api/experiments/[id]/experiment-run` | GET: `requireAuth`; POST: `requireAuthForExperiment` | — |
| `/api/experiments/[id]/analyze` | POST | `requireAuth` |
| `/api/experiments/[id]/conflicts` | GET | `requireAuth` |
| `/api/experiments/running` | GET | `requireAuth` |
| `/api/agent-tokens` | GET, POST | `requireAuth` |
| `/api/agent-tokens/[id]` | DELETE | `requireAuth` |
| `/api/agent-context/[projectKey]` | GET | `requireAuth` |
| `/api/agent-session/[projectKey]/[userId]` | GET, PUT | `requireAuth` |
| `/api/memory/project/[projectKey]` | GET, POST | `requireAuth` |
| `/api/memory/project/[projectKey]/[key]` | GET, DELETE | `requireAuth` |
| `/api/memory/user/[projectKey]/[userId]` | GET, POST | `requireAuth` |
| `/api/memory/user/[projectKey]/[userId]/[key]` | GET, DELETE | `requireAuth` |
| `/api/projects/[projectKey]/customer-endpoints` | GET, POST | `requireAuth` |
| `/api/projects/[projectKey]/customer-endpoints/[id]` | GET, PATCH, DELETE | `requireAuth` |
| `/api/projects/[projectKey]/customer-endpoints/[id]/test` | POST | `requireAuth` |
| `/api/sandbox0/chat/events` | GET | `requireAuth` |
| `/api/sandbox0/chat/send` | POST | `requireAuth` |
| `/api/sandbox0/chat/start` | POST | `requireAuth` |

### FeatBit proxy — intentional exception

`/api/featbit-proxy/[...path]` does not call any guard function. It reads the session optionally via `getSession()` and attaches the FeatBit JWT if one exists. Without a session, requests are forwarded with no `Authorization` header — FeatBit backend returns 401 for any of its own protected endpoints.

This is **intentional**: the proxy is a transparent pass-through to the FeatBit API; the FeatBit backend is the true auth enforcer for all FeatBit resources. Adding our own guard here would break the login flow or any other pre-login FeatBit call.

---

## Connector setup (end-to-end auth flow)

```sh
# 1. Issue a token from the web UI:
#    /data/env-settings → Agent tokens → Issue token → copy the fbat_… plaintext

# 2. In the shell where you run the connector, set the env vars:
$env:ACCESS_TOKEN = "fbat_..."
$env:SYNC_API_URL = "http://localhost:3000"   # or https://www.featbit.ai for prod

# 3. Start the connector:
npx @featbit/experimentation-claude-code-connector

# The connector inherits ACCESS_TOKEN into its process environment.
# When Claude Code (run by the SDK) executes bash commands, that env is inherited.
# sync.ts reads ACCESS_TOKEN and sends:  Authorization: Bearer fbat_...
# The web API:
#   1. Hashes the token and looks it up in AgentToken table
#   2. Checks revokedAt (rejects if set)
#   3. For experiment routes: checks token.projectKey === experiment.featbitProjectKey
#   4. Updates lastUsedAt (fire-and-forget)
```
