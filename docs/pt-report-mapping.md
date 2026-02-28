# Formal Report Outline ↔ Interim Summary Mapping

This document maps the planned **Formal Application-Layer Penetration Test Report** structure to the current interim summary so that final-report drafting can reuse validated content while adding evidence and findings.

## 1) Executive Summary

- **Interim source:** [docs/pt.md](docs/pt.md#L9-L21)
- **What to add in formal report:** testing window, systems tested, high-level risk posture, overall conclusion, key remediation priorities.

## 2) Scope

- **Interim source:** [docs/pt.md](docs/pt.md#L25-L45)
- **What to add in formal report:** exact in-scope endpoints/modules, out-of-scope exclusions, test-account matrix, environment identifiers, and assumptions.

## 3) Architecture Under Test

- **Interim source:** [docs/pt.md](docs/pt.md#L49-L70)
- **What to add in formal report:** data-flow diagrams, trust boundaries, entry points, auth boundaries, and deployment-specific security dependencies.

## 4) Methodology

- **Interim source:** [docs/pt.md](docs/pt.md#L180-L196)
- **What to add in formal report:** OWASP mapping, DAST setup details, manual test procedures, validation criteria, and false-positive handling rules.

## 5) Authentication & Session Assessment

- **Interim source:** [docs/pt.md](docs/pt.md#L74-L84)
- **What to add in formal report:** test cases for login/session handling, token misuse scenarios, expiry behavior, and SSO/OIDC flow checks.

## 6) Authorization & Access Control Assessment

- **Interim source:** [docs/pt.md](docs/pt.md#L88-L101)
- **What to add in formal report:** privilege matrix validation, project/environment isolation tests, horizontal/vertical authorization checks.

## 7) API/SDK/Streaming Assessment

- **Interim source:** [docs/pt.md](docs/pt.md#L105-L141)
- **What to add in formal report:** endpoint-by-endpoint tests, env-secret misuse tests, websocket auth checks, insights/custom-event ingestion abuse tests.

## 8) Integration/Webhook Assessment

- **Interim source:** [docs/pt.md](docs/pt.md#L131-L141)
- **What to add in formal report:** webhook signing validation, replay/tamper checks, retry behavior security impact, token-scope enforcement checks.

## 9) Data Protection & Logging Assessment

- **Interim source:** [docs/pt.md](docs/pt.md#L145-L158)
- **What to add in formal report:** transport configuration validation, sensitive-data exposure checks, audit-log coverage limitations and impact.

## 10) Findings & Severity Classification

- **Interim source:** [docs/pt.md](docs/pt.md#L203-L209)
- **What to add in formal report:** per-finding evidence, reproducibility steps, impact, severity (Critical/High/Medium/Low), affected components.

## 11) Remediation Plan & Mitigation Status

- **Interim source:** [docs/pt.md](docs/pt.md#L203-L209)
- **What to add in formal report:** remediation actions, owner, target date, current status, compensating controls, retest requirement.

## 12) Limitations and Disclaimer

- **Interim source:** [docs/pt.md](docs/pt.md#L220-L222)
- **What to add in formal report:** testing constraints, coverage limitations, environment restrictions, and statement of residual risk.

---

## Customer Scope Crosswalk (Quick View)

| Customer Requested Scope | Interim Coverage | Formal Report Section |
|---|---|---|
| Web application interfaces | [docs/pt.md](docs/pt.md#L51-L57), [docs/pt.md](docs/pt.md#L88-L95) | Sections 2, 3, 6 |
| Authentication and session management | [docs/pt.md](docs/pt.md#L74-L84) | Section 5 |
| Access control and authorization (RBAC) | [docs/pt.md](docs/pt.md#L88-L101) | Section 6 |
| Feature flag management APIs | [docs/pt.md](docs/pt.md#L25-L35), [docs/pt.md](docs/pt.md#L105-L112) | Sections 2, 7 |
| Administrative interfaces | [docs/pt.md](docs/pt.md#L25-L35), [docs/pt.md](docs/pt.md#L88-L95) | Sections 2, 6 |
| Public API endpoints used by client SDKs | [docs/pt.md](docs/pt.md#L105-L122) | Section 7 |

---

## Drafting Rule of Thumb

- Interim summary language = control overview and scope boundary.
- Formal report language = test evidence, findings, severity, and remediation tracking.
