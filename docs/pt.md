# FeatBit Application-Layer Penetration Test Report

Product: FeatBit (Self-Hosted Edition)  
Version Tested: [vX.X.X]  
Document Classification: Customer Confidential
Assessment Window: [Start Date – End Date]  
Report Date: [YYYY-MM-DD]  
Prepared by: FeatBit Inc.

---

This document presents the results of an application-layer penetration test conducted against the FeatBit (Self-Hosted Edition).

---
# ---
---

# Executive Summary

FeatBit conducted an application-layer penetration test of the **FeatBit (Self-Hosted Edition)** to validate the security controls described in the *FeatBit Application Security Summary (Interim), Version 1.1*.

Testing focused on authentication, authorization, API access control, runtime communication channels, input validation, and exception handling behavior.

No **Critical** or **High severity vulnerabilities** were identified during the assessment.

Two **Low severity robustness findings** related to input validation boundary conditions were identified. These findings do not allow authentication bypass, privilege escalation, or unauthorized data access.

**Overall Risk Rating: Low**

---

**Assessment Conclusion:**  
No Critical or High-risk vulnerabilities identified.

---
# ---
---

# Risk Rating Summary

The following table summarizes the vulnerability severity distribution identified during the assessment.

| Severity | Count |
|--------|------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 2 |
| Informational | 0 |

---

## Identified Findings

| ID | Title | Severity |
|----|------|---------|
| FB-PT-001 | Pagination Parameter Validation Weakness | Low |
| FB-PT-002 | Oversized String Input Handling | Low |

---

## Overall Risk Rating

**Low**

No vulnerabilities with significant security impact were identified.

---
# ---
---

# 1. Objective

The objective of this assessment is to validate the effectiveness of the application-layer security controls described in the **FeatBit Application Security Summary (Interim), Version 1.1**.

This assessment focuses on identifying potential **Critical** and **High-risk** vulnerabilities within the application layer of **FeatBit (Self-Hosted Edition)**, while also documenting lower-severity robustness issues observed during testing.

Testing was performed in alignment with **OWASP Top 10:2025** and contemporary application security assessment practices.

Infrastructure security, operating system security, network-layer controls, and source-code review were explicitly out of scope for this assessment.

---

# 2. Scope Alignment with Security Summary

The assessment scope of this assessment reflects the application-layer responsibilities defined in the **FeatBit Application Security Summary (Interim), Version 1.1**.

## 2.1 In Scope (Application Layer)

The following application-layer components and control domains were included in testing:

- FeatBit Dashboard (web front-end for user operations and administration)
- FeatBit API service (REST APIs for dashboard and feature/configuration management)
- FeatBit evaluation service (SDK-facing evaluation paths, including real-time channel behavior)
- FeatBit data analytics service (insight retrieval and analytics APIs)
- FeatBit SDK behavior and integration security boundaries (from an application-layer perspective)
- Integration capabilities, including webhook-based outbound integrations and API-token-based integrations
- Authentication and session management controls
- Authorization and role-based access control (RBAC)
- Administrative operation protections
- Feature flag data access isolation by project/environment context

## 2.2 Out of Scope (Customer-Managed Infrastructure Layer)

Consistent with the Security Summary, the following elements were not included in this assessment:

- Host, operating system, network perimeter, and firewall controls
- Kubernetes / VM / container hardening
- Database platform patching, encryption-at-rest implementation, and key management
- WAF, SIEM, and infrastructure monitoring policy configuration
- TLS termination, certificate lifecycle management, and reverse-proxy / load-balancer security configuration

FeatBit is deployed using a customer-controlled self-hosted model. As such, infrastructure and platform controls remain under customer ownership and were not part of this application-layer penetration test.

---

# 3. Methodology

This assessment was conducted as an **application-layer security evaluation** to validate the controls described in the **FeatBit Application Security Summary (Interim), Version 1.1**.

The testing methodology aligns with **OWASP Top 10:2025** risk categories where applicable to FeatBit components, as referenced in Section 9 of the Security Summary.

## 3.1 Testing Approach

The testing approach included:

- Black-box dynamic testing against exposed application interfaces
- Authenticated testing using multiple user roles
- Manual authorization and privilege-boundary validation
- Injection payload simulation aligned with OWASP Injection risk categories
- Token and session manipulation testing aligned with Authentication risk categories
- Cross-project and cross-environment isolation validation aligned with Access Control risk categories
- WebSocket authentication and scope validation
- Webhook integrity and signature validation
- Error-handling and boundary-condition analysis aligned with Exceptional Conditions risk categories

## 3.2 Testing Accounts

The following account types were used during testing:

- Administrator account
- Standard user account
- Unauthenticated access attempts

This ensured meaningful validation of authentication requirements, role-based access boundaries, and privilege enforcement behavior.

## 3.3 Tooling

Primary tooling used during the assessment included:

- **OWASP ZAP** (used as an interception proxy and request manipulation tool)
- Manual HTTP request inspection and replay
- Browser developer tools for request inspection, token handling observation, and client-side behavior validation

Security testing was conducted primarily through manual validation of authentication, authorization, API behavior, and runtime communication controls, with OWASP ZAP assisting in interception, replay, and parameter manipulation.

All testing activities were conducted against a controlled FeatBit deployment environment.

## 3.4 Environment

All testing was conducted against a controlled self-hosted deployment environment consistent with the architecture described in **Section 3** of the Security Summary.

Testing was isolated from production customer workloads.

## 3.5 Assessment Limitations

This assessment represents a point-in-time application-layer penetration test.

The following activities were not performed as part of this engagement:

- Source code review
- Infrastructure or network penetration testing
- Denial-of-service or load testing
- Third-party dependency / software composition analysis
- Cryptographic implementation review beyond observable application-layer behavior

Accordingly, the absence of findings in this report should not be interpreted as a guarantee that no vulnerabilities exist.

---

# 4. Control Validation by Security Domain

---

## 4.1 Authentication & Session Security
(Summary Section 4 Validation)

### 4.1.1 Unauthenticated Access

**Action**:

Attempted direct access to representative protected management
endpoints without providing an authentication token.

**Endpoints Tested (Representative Sample)**:

- GET /api/v1/xxx
  (List all projects in the workspace)
- GET /api/v1/xxx
  (List all environments in a project)
- GET /api/v1/xxx
  (List all feature flags in an environment)
- GET /api/v1/xxx
  (Get feature flag details)
- POST /api/v1/xxx
  (Update the status of a feature flag)
- POST /api/v1/xxx
  (Update a member's policy)
- GET /api/v1/xxx
  (Get the server environment secret)

**Observed Behavior**:

All tested endpoints returned HTTP 401 Unauthorized
or 403 Forbidden responses.

No data payload was returned.
No internal stack traces or implementation details were exposed.

**Pass Criteria**:

Protected management endpoints must reject unauthenticated requests
and must not disclose sensitive data.

**Conclusion**:

Authentication enforcement is consistently applied across
representative read, write, destructive, and administrative operations.

---

### 4.1.2 Token Replay

**Action**:

A previously captured authenticated request was replayed using OWASP ZAP
under different session conditions to evaluate token lifecycle enforcement.

**Test Scenarios**:

1. Replay after logout:
   - User session was terminated via logout.
   - Previously captured request containing a valid token was replayed.

2. Token tampering:
   - The token value was modified to invalidate its signature.
   - The request was resent with the altered token.

3. Token expiration:
   - Token validity period configured at approximately 2 hours.

**Observed Behavior**:

- Replay after logout returned HTTP 401 Unauthorized.
- Token tampering returned HTTP 403 Forbidden.
- Token expiration window is enforced at approximately 2 hours.

No protected data was returned in any invalid-token scenario.

**Conclusion**:

Session lifecycle controls are functioning as expected.
Invalid, tampered, or post-logout tokens were rejected by the application.

Token validity duration (approximately 2 hours) is enforced
according to current authentication configuration.

---

### 4.1.3 OIDC (If Enabled)

**Action**:

Tested whether management APIs could be accessed without
a valid federated authentication token when OIDC authentication
is enabled.

**Test Scenarios**:

1. Direct API access without Authorization token
2. API access using a forged Bearer token

**Observed Behavior**:

- Requests without an Authorization header returned HTTP 401 Unauthorized.
- Requests using forged or invalid Bearer tokens were rejected with HTTP 401 or 403 responses.

**Token Validation Behavior**:

API access requires a valid Bearer token issued through the OIDC authentication flow.

Invalid or missing tokens are rejected before protected resources are returned.

**Conclusion**:

- Federated authentication boundaries are enforced correctly.
- Access to management APIs requires a valid authentication token issued through the OIDC login flow.

---

## 4.2 Authorization & RBAC Enforcement
(Summary Section 5 Validation)

### 4.2.1 Cross-Project Access

**Action**:

Tested whether an authenticated user could access or modify resources belonging to another project by manipulating project identifiers within API requests.

Representative API endpoints covering different resource types and privilege levels were tested.

**Endpoints Tested (Representative Sample)**:

- GET /api/v1/projects/{projectId}/envs/{envId}/flags  
  (retrieve feature flag definitions)

- GET /api/v1/projects/{projectId}/segments  
  (retrieve user segmentation configuration)

- POST /api/v1/projects/{projectId}/flags  
  (create or update feature flag configuration)

- GET /api/v1/projects/{projectId}/members  
  (retrieve project member permissions)

- PUT /api/v1/projects/{projectId}/members/{memberId}  
  (update project member permissions)

**Test Scenario**:

1. A valid request was captured for resources belonging to Project A.
2. The `projectId` parameter was replaced with the identifier of Project B.
3. The request was resent using the original authenticated user token.

**Observed Behavior**:

All modified requests attempting to access resources from another project were rejected with HTTP 403 Forbidden.

No data belonging to other projects was returned.

**Conclusion**:

- Project-level isolation is enforced correctly.
- Authenticated users cannot access or manipulate resources belonging to other projects.

---

### 4.2.2 Privilege Escalation Attempt

**Action**:

Tested whether an authenticated non-administrative user could perform privileged administrative operations by directly invoking restricted API endpoints.

This test validates that role-based authorization controls are enforced server-side and cannot be bypassed by replaying or modifying requests.

**Endpoints Tested (Representative Sample)**:

- PUT /api/v1/projects/{projectId}/flags/{flagId}  
  (modify feature flag configuration)

- DELETE /api/v1/projects/{projectId}/segments/{segmentId}  
  (delete segmentation rule)

- PUT /api/v1/projects/{projectId}/members/{memberId}  
  (modify project member permissions)

**Test Scenario**:

The "standard user" used in this test refers to an authenticated
user account without administrative privileges.

1. A standard user account was authenticated through the normal
   application login process.

2. Administrative API requests were captured from legitimate
   administrator actions.

3. The captured requests were replayed using the standard
   user's authentication token.

4. Requests were executed using OWASP ZAP to determine whether
   the server allowed unauthorized administrative operations.

**Observed Behavior**:

All administrative API requests executed using the standard user token were rejected with HTTP 403 Forbidden responses.

No configuration changes were applied and no privileged operations were executed.

**Conclusion**:

Privilege escalation attempts were unsuccessful.

Server-side authorization checks correctly prevent non-administrative users from executing restricted administrative operations.

---

### 4.2.3 Administrative Operation Protection

**Action**:

Evaluated whether an authenticated user could access resources belonging to another user by manipulating user-related identifiers in API requests.

**Assessment Notes**:

FeatBit derives user identity exclusively from validated authentication tokens. User identifiers and roles are not accepted as client-supplied parameters in API requests.

Authorization decisions are performed server-side based on the authenticated user's identity and associated permissions.

**Observed Behavior**:

No user-controlled identifiers were identified that could be manipulated to access resources belonging to other users.

All authorization decisions are enforced based on the validated authentication token.

**Conclusion**:

No horizontal privilege escalation attack surface was identified in the tested API endpoints.

User identity and associated permissions are enforced server-side and cannot be overridden through request manipulation.

---

## 4.3 API, SDK & Real-Time Channel Security
(Summary Section 6 Validation)

This section evaluates security controls applied to FeatBit’s programmatic access channels.

These interfaces enable automated system interaction, including CI/CD pipelines, infrastructure automation, SDK runtime evaluation, and integration events.

Testing focuses on authentication enforcement, authorization boundaries, environment isolation, and integrity protections across these channels.

---

### 4.3.1 Programmatic Management API (Access Token Enforcement)

FeatBit provides programmatic management APIs that can be invoked using access tokens.  
These APIs enable automated interaction with the platform, including CI/CD pipelines, infrastructure-as-code workflows, command-line tooling, automation agents, integration connectors, and other non-interactive access patterns.

Testing focused on validating authentication enforcement and authorization boundaries for these programmatic access channels.

**Action**:

The following security validations were performed:

- Attempted access to management APIs without authentication
- Attempted access using invalid or malformed access tokens
- Attempted privileged operations using limited-scope tokens
- Verified that SDK or evaluation credentials cannot access management APIs

**Representative Endpoints Tested**:

```
GET  /api/v1/projects
POST /api/v1/projects/{projectId}/flags
DELETE /api/v1/projects/{projectId}/segments/{segmentId}
PUT  /api/v1/workspaces/{workspaceId}/settings
```

These endpoints represent common management operations including project listing, feature flag creation, configuration deletion, and workspace-level configuration updates.

**Observed Behavior**:

Testing results were consistent across the evaluated endpoints:

- Requests without authentication tokens returned HTTP **[401/403]**.
- Requests using invalid or tampered tokens returned HTTP **[401]**.
- Limited-scope tokens attempting privileged operations returned HTTP **[403]**.
- Administrative tokens successfully executed authorized operations and returned HTTP **[200/201]**.
- SDK environment credentials were rejected when used against management API endpoints.

No cases were identified where programmatic management APIs could be accessed without proper authentication or authorization.

**Conclusion**:

Programmatic management APIs enforce authentication through access tokens and apply server-side authorization checks to privileged operations.

Access tokens are validated prior to request processing, and authorization boundaries prevent limited-scope tokens from executing administrative actions.

SDK evaluation credentials cannot be used to invoke management APIs, ensuring separation between runtime evaluation interfaces and management operations.

---

### 4.3.2 Feature Flag Evaluation Interface Security

FeatBit provides runtime evaluation interfaces that allow client applications to retrieve feature flag configurations and submit runtime events.

These interfaces may be accessed by official SDKs, client polling implementations, or customer-managed evaluation services.

Unlike management APIs, these endpoints rely on environment-scoped credentials and are intended for application runtime usage.

**Action**:

The following security validations were performed:

- Attempted access to evaluation interfaces without environment credentials
- Attempted cross-environment access using environment-specific credentials
- Attempted use of evaluation credentials against management API endpoints
- Submission of malformed input through runtime event ingestion endpoints

**Representative Endpoints Tested**:

```
GET  [feature flag evaluation endpoint]
POST [runtime event/insight endpoint]
POST [evaluation context endpoint]
```

These endpoints represent typical runtime interactions used by SDKs, polling clients, or custom evaluation services.

**Observed Behavior**:

Testing results were consistent across evaluated endpoints:

- Requests without environment credentials returned HTTP **[401/403]**
- Environment credentials were restricted to their associated environment scope
- Evaluation credentials could not access management API endpoints
- Malformed or unexpected payloads were rejected by server-side validation

No cases were identified where runtime evaluation credentials could access management operations or resources outside their authorized environment scope.

**Conclusion**:

Runtime evaluation interfaces enforce environment-scoped authentication and prevent misuse of runtime credentials.

Evaluation credentials cannot be used to invoke management APIs and remain restricted to their intended feature flag evaluation scope.

---

### 4.3.3 Real-Time Streaming Channel Security (WebSocket)

FeatBit supports real-time configuration delivery through WebSocket streaming channels used by SDKs to receive feature flag updates.

**Observed Endpoints (Redacted):**
- Client SDK streaming:
  - `wss://app-eval.featbit.co/streaming?type=client&token=<redacted>`
- Server SDK streaming:
  - `wss://app-eval.featbit.co/streaming?type=server&token=<redacted>`

Successful protocol upgrade was observed as HTTP **101 Switching Protocols**.

In the tested deployment, the WebSocket channel is authenticated using an **opaque credential token** provided via the `token` query parameter. This token is generated based on the environment secret and is **decrypted/validated server-side** to recover the effective environment secret for authorization decisions.

Client and Server streaming tokens are **type-scoped** and are not interchangeable. Tokens issued for `type=client` cannot be used for `type=server`, and vice versa.

> Note: The `token` query parameter is an authentication credential. Anyone in possession of this token could attempt to establish a streaming connection, so it must be treated as sensitive.

**Action**:

Validations were performed using browser developer tools and OWASP ZAP-assisted request manipulation:

1) **Handshake & Credential Validation (Client + Server)**
- Established connections using valid client/server tokens and observed normal streaming behavior
- Tampered token values (character-level modification) and re-attempted connection establishment
- Verified invalid/expired credentials are rejected at the application layer (post-upgrade)

2) **Token Type Separation (Client vs Server)**
- Attempted to use a `type=client` token against the `type=server` streaming endpoint
- Attempted to use a `type=server` token against the `type=client` streaming endpoint

3) **Environment Scope Isolation (Behavioral Validation)**
- Established a connection using Env A token and observed that updates were delivered only when flags changed in Env A
- Triggered flag changes in Env B and verified no updates were delivered to the Env A connection
- Repeated the same validation using Env B token as a control
- Performed the same behavioral isolation validation for both `type=client` and `type=server` where applicable

4) **Protocol & Message Handling Observation**
- Observed application-level message patterns including:
  - `messageType: "data-sync"` payloads for runtime configuration synchronization
  - periodic `ping/pong` keepalive messages
- Verified that no protected runtime payloads were delivered in invalid-credential scenarios

5) **SDK Resilience / Reconnect Behavior (Observation)**
- Observed SDK behavior when the streaming channel was terminated by the server (automatic reconnect attempts)

**Observed Behavior**:

- With **valid tokens**, the server upgraded the connection to WebSocket (HTTP **101**) and the SDK received runtime synchronization payloads (e.g., `messageType: "data-sync"`) followed by periodic `ping/pong` keepalive messages.

- With an **invalid / expired / tampered token**:
  - The server still returned HTTP **101 Switching Protocols** (WebSocket upgrade completed).
  - **No runtime data** (no `data-sync` payloads) was delivered after the upgrade.
  - The server then **actively closed** the WebSocket connection with close code **4003**, indicating application-layer credential validation failure.
  - The SDK automatically attempted to **re-establish** the WebSocket connection (expected reconnect behavior).

- **Token type separation** was enforced:
  - Using a `type=client` token against `type=server` did not result in any runtime data being delivered, and the connection was closed with **4003**.
  - Using a `type=server` token against `type=client` behaved similarly (no runtime data, closed with **4003**).

- **Environment isolation** was enforced through behavioral validation:
  - A connection established using an Env A token only received updates when changes occurred within Env A.
  - Changes made in Env B did **not** result in any updates delivered to the Env A connection (and vice versa when tested with Env B token).

**Interpretation Note**:

HTTP **101** indicates protocol upgrade only. Authorization is enforced at the application layer after the WebSocket channel is established; invalid or mis-scoped credentials result in the server closing the channel (close code **4003**) before any protected data is streamed.

**Client-Side Caching Note (Operational Behavior)**:

The client SDK stores the most recent runtime flag data in **browser local storage** to support resilience under intermittent connectivity and allow retrieval of the last known configuration when the connection is unstable.

This caching behavior is client-side and does not provide additional server-side access; streaming and evaluation access remains gated by server-side token validation.

**Conclusion**:

The WebSocket streaming channels enforce environment-scoped authentication using an encrypted/opaque credential token that is decrypted and validated server-side.

Invalid, expired, or mis-scoped credentials do not result in any protected runtime data being streamed; instead, the server terminates the channel with close code **4003** shortly after upgrade.  
Behavioral testing confirms strict environment isolation and **type separation** between client and server streaming channels, making the real-time delivery mechanism suitable for SDK runtime usage under authenticated, scope-consistent controls.

---

### 4.3.4 Webhook Integration Security

FeatBit supports outbound webhook integrations that notify external systems when selected Feature Flag or Segment events occur. When a subscribed event is triggered, FeatBit sends an HTTP **POST** request to the configured webhook URL.

Webhooks can be configured with:
- **Scopes (environments)**: the webhook triggers only for events occurring in selected environments
- **Events**: selectable event types (e.g., `feature_flag.toggled`, `feature_flag.targeting_rules_changed`, `segment.rules_changed`)
- **Custom headers**: optional headers added to outbound requests
- **Payload template**: a Handlebars-based template to generate the POST body
- **Secret** (optional): enables payload signing via `X-FeatBit-Signature-256`

> Note: Webhook endpoints should be treated as security-sensitive integration surfaces because they can carry configuration change context. Receivers should validate the signature (when enabled) and implement idempotent processing.

**Action**:

Webhook security validation focuses on authenticity, integrity, and replay resilience using a controlled receiver endpoint:

1) **Event & Scope Enforcement**
- Configure a webhook with a constrained set of **environment scopes** and **event types**
- Trigger subscribed events inside selected environments and verify deliveries occur
- Trigger similar events in non-selected environments and verify no deliveries occur

2) **Delivery Header Verification**
- Capture outbound webhook requests and verify FeatBit includes delivery correlation headers:
  - `X-FeatBit-Delivery` (delivery GUID)
  - `X-FeatBit-Event` (event name)
  - `X-FeatBit-Hook-ID` (webhook identifier)
- Confirm optional **custom headers** are attached when configured

3) **Payload Integrity via Signature Verification (Secret Enabled)**
- Configure a webhook **secret** and validate that FeatBit includes `X-FeatBit-Signature-256`
- Recompute an **HMAC-SHA256** signature over the raw request body using the shared secret and compare with the header value
- Tamper with the payload at the receiver side (simulate MITM/modification) and confirm signature validation fails

4) **Retry / Replay Considerations**
- Validate receiver-side idempotency using `X-FeatBit-Delivery` (dedupe repeated deliveries)
- Simulate transient failures (non-2xx responses / slow response) and observe retry behavior
- Confirm re-deliveries preserve the same `X-FeatBit-Delivery` identifier for safe deduplication

5) **Operational Validation (Live Debug)**
- Use FeatBit’s Live Debug functionality to send test deliveries and inspect request/response details during setup and troubleshooting

**Observed Behavior**:

- FeatBit sends webhook deliveries as HTTP POST requests to the configured URL when subscribed events occur within selected environment scopes.
- Outbound deliveries include built-in headers `X-FeatBit-Delivery`, `X-FeatBit-Event`, and `X-FeatBit-Hook-ID`.
- When a webhook secret is configured, FeatBit includes `X-FeatBit-Signature-256`, documented as an HMAC hex digest of the request body using SHA-256 with the webhook secret as the HMAC key. The signature value is prefixed with `sha256=`.
- Each webhook request has a **10-second timeout**. Failed deliveries are retried up to **3 times** with a **2-second delay** between retries.
- For redelivery scenarios, `X-FeatBit-Delivery` remains consistent with the original delivery, enabling receiver-side replay protection through deduplication.

**Conclusion**:

FeatBit webhook integrations provide practical application-layer integrity and replay-resilience mechanisms:

- **Integrity & authenticity** can be enforced by receivers using `X-FeatBit-Signature-256` (HMAC-SHA256) when a webhook secret is enabled.
- **Replay/duplicate delivery handling** is supported via `X-FeatBit-Delivery`, allowing idempotent processing and deduplication across retries/redeliveries.
- Operational tooling (Live Debug, payload templates, scopes, and custom headers) supports secure and maintainable integration workflows when combined with receiver-side signature validation and fast 2xx responses.

---

## 4.4 Injection & Input Validation
(Summary Sections 6 and 9 Validation)

### 4.4.1 Stored Cross-Site Scripting (XSS) Validation

This section validates that user-controlled inputs entered via the FeatBit Dashboard are safely handled when persisted and later rendered back in the UI (stored XSS).

**Action**

Stored XSS probes were submitted through representative Dashboard input fields that are persisted server-side and displayed back in the UI after save.

**Tested Inputs (Representative)**

- Representative persisted text fields in the Dashboard UI (e.g., name/description or other user-editable display fields that appear in list/detail views).

**Payloads Tested (Safe Sampling)**

- `<img src=x onerror=alert(1)>`
- `<svg onload=alert(1)>`
- `<script>alert(1)</script>`
- `"><script>alert(1)</script>`

**Observed Behavior**

- After saving the inputs and revisiting the relevant Dashboard pages where the stored values are rendered (e.g., list/detail views), no script execution occurred.
- The payloads did not trigger JavaScript execution and did not result in unexpected DOM/script injection behavior.
- No error pages, stack traces, or security-relevant exceptions were observed during rendering.

**Conclusion**

No stored XSS behavior was identified in the tested Dashboard inputs. User-provided content appears to be safely handled when persisted and rendered back in the UI, and the tested payloads did not execute.

---

### 4.4.2 Reflected / DOM XSS Validation (Dashboard Search Parameters)

This section validates that user-controlled query parameters used by the FeatBit Dashboard (single-page application) do not result in reflected or DOM-based XSS when rendered in the UI.

The Feature Flags list page was used as a representative surface due to its use of URL query parameters and search filtering behavior.

**Action**:

Reflected/DOM XSS probes were tested through Dashboard search inputs that are propagated into URL query parameters and API requests.

Representative test surface:
- Feature Flags list page search parameter (e.g., `name=...`) reflected in the browser URL and used for list filtering.

Payloads tested (safe sampling):
- `<img src=x onerror=alert(1)>`
- `<svg/onload=alert(1)>`
- `"><svg/onload=alert(1)>` (quote-escape variant)

**Validation steps**:
- Inject payloads into the Dashboard search field and observe whether JavaScript execution occurs.
- Confirm payload handling in the URL query string (encoding behavior).
- Inspect network requests/responses associated with list filtering to ensure no unsafe reflection in returned data.
- Observe any UI locations beyond the input field (e.g., chips, filter labels, empty-state text, toast messages) for unsafe rendering.

**Observed Behavior**:

- Payloads entered into the search field were represented in the URL query parameters in an encoded form (e.g., percent-encoded characters), and no direct HTML interpretation was observed.
- The search value was displayed as plain text within the input field; no script execution occurred and no alert was triggered.
- No evidence was observed of the payload being rendered as HTML in other UI components (e.g., filter labels, badges, empty-state messages).
- Network responses related to filtering did not exhibit unsafe reflection that led to execution, and no server-side error pages, stack traces, or exception details were observed during testing.

**Conclusion**

No reflected or DOM-based XSS behavior was identified in the tested Dashboard search/query parameter surfaces. User-provided search values appear to be safely handled and rendered as text without script execution.

### 4.4.3 API Query Injection & Parameter Validation (Open API)

This section validates that FeatBit’s Open API query parameters cannot be abused for SQL/Query injection and that filtering/pagination parameters enforce safe server-side validation.

**Representative Endpoints**:

- Tested: `GET /api/v1/envs/{envId}/audit-logs`
- Recommended additional coverage (quick sampling):
  - `GET [Feature Flags list endpoint]`
  - `GET [Segments list endpoint]`

**Action**:

1) **Query Injection Probes (Search/Filter Parameters)**
- Baseline request with an empty query string (where applicable)
- Injection probes applied to search/filter parameters (e.g., `query`, `name`, `q`):
  - `'`
  - `"` (optional)
  - `' OR 1=1 --`
  - `') OR ('1'='1` (optional)

2) **Pagination Parameter Type & Boundary Tests**
- Non-integer input for page sizing (e.g., `pageSize=1 OR 1=1`)
- Negative boundary test (e.g., `pageSize=-1`)
- Excessively large value test (e.g., `pageSize=999999`)

**Observed Behavior (Audit Logs Endpoint)**:

- Baseline (query empty) returned HTTP **200 OK** with a non-zero result set (`totalCount=1`).
- Injection probes on `query` returned HTTP **200 OK** with stable response structure and did not expand results beyond baseline (e.g., `totalCount=0` under `'` and `' OR 1=1 --`). No SQL/ORM errors, stack traces, or backend details were disclosed.
- `pageSize=1 OR 1=1` was rejected with HTTP **400 Bad Request** and a structured validation error (type enforcement).
- `pageSize=999999` was accepted (no maximum enforced).
- `pageSize=-1` triggered HTTP **500 Internal Server Error** (unhandled boundary case).

**Conclusion**:

No exploitable SQL/Query injection behavior was observed for tested search parameters. Type validation is enforced for numeric pagination inputs.

A robustness gap was identified in pagination bounds and negative-value handling, which may pose availability/stability risk under large datasets or repeated invalid requests.

---

### 4.4.4 Schema / Type / Boundary Validation (Write APIs)

This section validates that FeatBit write APIs enforce structured server-side validation for JSON request bodies, including required fields, JSON parsing, type enforcement, and safe handling of unexpected fields.

**Representative Endpoints Tested**:

- Create / Update Feature Flag (management APIs)
- Create / Update Segment (management APIs)
- Create Audit Log (administrative / governance surface)
- Create Change Request (administrative workflow surface)

**Action**:

The following input validation scenarios were tested by capturing baseline POST/PUT requests and replaying modified payloads:

1) **Invalid JSON**
- Submitted malformed JSON payloads (e.g., missing closing braces, invalid commas).

2) **Missing Required Fields**
- Removed required fields from request bodies (e.g., omitting `key` during feature flag creation).

3) **Type Mismatch / Type Confusion**
- Replaced expected scalar types with incorrect types (e.g., string fields replaced with objects/arrays; arrays replaced with strings).

4) **Oversized Strings (Boundary / Length Testing)**
- Submitted unusually long strings in representative text fields to validate length handling.

5) **Unexpected / Extra Fields**
- Added non-schema fields to request bodies to validate that they do not alter behavior or authorization outcomes.

**Observed Behavior**:

- **Invalid JSON** payloads were rejected with HTTP **400 Bad Request**.
- **Missing required fields** were rejected with HTTP **400 Bad Request** and clear validation messages (e.g., `success:false` with errors such as `key_is_required`).
- **Type mismatch** payloads were rejected with HTTP **400 Bad Request**.
- **Unexpected fields** did not change behavior or authorization outcomes (fields were safely ignored and did not produce privileged effects).
- **Oversized string inputs** were handled inconsistently:
  - Some endpoints returned controlled **4xx** validation errors.
  - Some endpoints returned HTTP **500 Internal Server Error** for oversized string inputs.
  - No performance degradation or service instability was observed during these tests; however, returning **500** indicates an unhandled validation boundary case.

**Conclusion**:

FeatBit demonstrates strong baseline schema validation for malformed JSON, missing required fields, type mismatches, and unexpected fields across tested write APIs.

A robustness gap was identified for oversized string handling, where certain inputs can trigger HTTP 500 responses. This behavior should be normalized to controlled 4xx validation errors with consistent length limits.

---

## 4.5 Cryptographic & Transport Security
(Summary Section 7 Validation)

This section validates that FeatBit communicates over encrypted transport channels and that application endpoints are compatible with secure deployment configurations.

**Action**:

The following transport-layer security checks were performed during testing:

- Verified that Dashboard and API endpoints operate over HTTPS.
- Verified that streaming connections use secure WebSocket (`wss://`).
- Attempted access to resources to observe whether mixed content occurs (HTTPS pages loading HTTP resources).
- Observed transport security headers returned by API responses.
- Attempted HTTP access behavior to determine whether downgrade protection is enforced by the deployment configuration.

**Observed Behavior**:

- All tested application endpoints (Dashboard, APIs, and streaming interfaces) operated over **HTTPS** or **WSS** in the test environment.
- Real-time streaming connections were established via **`wss://`**, ensuring TLS protection for feature flag streaming data.
- No **mixed-content** issues were observed; HTTPS pages did not attempt to load HTTP resources.
- API responses included transport hardening headers such as  
  `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- In the test environment configured with HTTPS enforcement, HTTP downgrade attempts were not permitted and all application communication remained encrypted.

**Deployment Considerations**:

FeatBit supports deployment behind customer-managed infrastructure (e.g., reverse proxies, ingress controllers, or load balancers).  
As such, enforcement of HTTPS-only access, TLS configuration, and HTTP-to-HTTPS redirection behavior may depend on the deployment environment rather than the application itself.

**Conclusion**:

Transport encryption was successfully validated at the application layer.  
The FeatBit platform operates correctly over **HTTPS and WSS**, does not introduce mixed-content issues, and is compatible with secure HTTPS-enforced deployments.  
TLS enforcement policies (e.g., HTTP redirection or listener configuration) are deployment-specific responsibilities in self-hosted environments.

---

## 4.6 Data Protection & Secret Exposure
(Summary Section 7 Validation)

This section evaluates whether FeatBit exposes sensitive information through API responses, error messages, client-side storage, or audit logs.

**Action**:

The following checks were performed:

- Reviewed representative API responses for exposure of sensitive credentials or internal secrets.
- Triggered various error conditions (invalid JSON, schema violations, injection probes) to inspect error responses.
- Inspected browser storage used by the Dashboard application.
- Reviewed audit log records for potential leakage of credentials or secrets.

**Observed Behavior**:

**API Responses**

Certain API responses intentionally return credentials that are required for authorized users to configure and operate the platform:

- Authentication endpoints return **JWT access tokens** as part of the login process.
- Access Token management APIs return **user-generated access tokens** for programmatic access.
- Project configuration APIs expose **environment secrets (envSecret)** used by SDKs for runtime feature flag evaluation.

These values are returned only to authenticated users with appropriate permissions and are necessary for normal platform operation.

No unintended exposure of internal secrets (e.g., database credentials, private keys, connection strings) was observed in API responses.

**Error Responses**

Error responses generated during testing returned controlled HTTP **4xx/5xx** responses without exposing:

- stack traces
- internal class or namespace information
- SQL queries
- database connection strings

This indicates proper exception handling and error sanitization.

**Client-Side Storage**

The FeatBit Dashboard stores certain session data in browser storage as part of its single-page application architecture, including:

- user authentication token
- user information
- feature flag cache

The authentication token is cleared on logout and subject to expiration.

SDK clients may locally cache evaluated feature flags for runtime performance.

No environment secrets or private access tokens were observed stored in browser storage for the Dashboard.

**Audit Logs**

Audit log records were reviewed and do not contain sensitive credentials such as tokens, secrets, or passwords.

**Conclusion**:

Testing did not identify unintended exposure of sensitive information through API responses, error handling, client-side storage, or audit logs.

Certain credentials (JWT tokens, access tokens, and envSecret values) are intentionally exposed to authorized users as part of normal platform operation and do not represent a vulnerability when used within authenticated contexts.

---

## 4.7 Logging & Auditability
(Summary Section 8 Validation)

This section evaluates whether FeatBit provides sufficient audit logging for security-relevant actions and whether audit records avoid exposing sensitive information.

**Action**:

The following configuration changes were performed during testing in the **FeatBit internal testing environment**:

- Creation and modification of feature flags
- Segment creation and modification

After performing these actions, the Audit Logs interface and corresponding API responses were reviewed through:

- Dashboard UI
- API endpoint:

```
GET https://app-api.featbit.co/api/v1/envs/{envId}/audit-logs
```

Representative request used during testing:

```
# All feature flags and segments changes audit logs for a specific environment (crossEnvironment=false)
https://app-api.featbit.co/api/v1/envs/{envId}/audit-logs?crossEnvironment=false&query=&creatorId=&refType=&refId=&from=&to=&pageIndex=0&pageSize=1

# A specific feature flags changes for a specific environment (crossEnvironment=false)
https://app-api.featbit.co/api/v1/envs/{envId}/audit-logs?crossEnvironment=false&query=&creatorId=&refType=FeatureFlag&refId={refId}&from=&to=&pageIndex=0&pageSize=10

# A specific shared segment changes across the scope of shared environment (crossEnvironment=true)
https://app-api.featbit.co/api/v1/envs/{envId}/audit-logs?crossEnvironment=true&query=&creatorId=&refType=Segment&refId={refId}&from=&to=&pageIndex=0&pageSize=10
```

The `refType` filter supports the following values:

- `FeatureFlag`
- `Segment`
- empty (return all supported resource types)

**Observed Behavior**

Configuration changes to **Feature Flags** and **Segments** generated corresponding audit log entries.

Audit log entries contained the following metadata:

- action type (e.g., feature flag modification, segment update)
- target resource identifiers (e.g., `flagId`, `segmentId`)
- actor/user information associated with the action
- timestamp of the operation

Audit records were successfully retrievable through both the Dashboard interface and the audit log API.

During inspection of audit log entries:

- No authentication tokens were recorded
- No environment secrets were recorded
- No passwords or credentials were recorded

Audit log payloads contained only operational metadata necessary for governance and traceability.

Audit log filtering using the `refType` parameter successfully limited results to specific resource categories (`FeatureFlag` or `Segment`).

It should be noted that audit logging currently covers configuration changes for **Feature Flags** and **Segments**. Other administrative operations may not yet generate audit log entries.

**Conclusion**

Audit logging functionality is implemented for key configuration resources (Feature Flags and Segments) and provides traceability for configuration changes.

Audit records do not contain sensitive credentials or secrets and support operational accountability for configuration management activities within FeatBit deployments.

---

## 4.8 Exception Handling & Error Exposure
(Summary Section 9 Validation)

This section evaluates whether FeatBit properly handles application errors without exposing sensitive internal implementation details.

**Action**

Various invalid or unexpected inputs were submitted to the system in order to trigger error conditions, including:

- malformed JSON payloads
- missing required fields
- invalid parameter types
- injection-style input payloads
- boundary conditions for pagination and string length

The resulting responses were inspected for potential information leakage.

**Observed Behavior**

Across tested endpoints:

- Invalid JSON payloads returned HTTP **400 Bad Request** responses.
- Missing required fields returned HTTP **400** validation responses.
- Type mismatches returned HTTP **400** validation responses.
- Injection probes did not produce SQL errors or internal stack traces.
- Error responses did not expose:
  - stack traces
  - internal class names
  - database queries
  - connection strings

In certain boundary conditions (e.g., invalid pagination values or oversized inputs), HTTP **500 Internal Server Error** responses were observed. These responses did not expose internal implementation details but indicate unhandled validation paths (documented in the Findings section).

**Conclusion**

Exception handling is generally implemented correctly and prevents disclosure of sensitive internal information.  
Most invalid inputs are handled through controlled validation responses.

Some boundary cases currently produce HTTP 500 responses instead of controlled validation errors; these cases have been documented separately as robustness findings.

---

# 5. OWASP Top 10:2025 Coverage Summary

The following table summarizes how the FeatBit application-layer assessment aligns with **OWASP Top 10:2025** categories.

| OWASP Category | Validation Coverage | Result |
|----------------|--------------------|--------|
| A01 Broken Access Control | Cross-project access isolation, RBAC enforcement, privilege escalation attempts, environment scope separation | No bypass observed |
| A02 Security Misconfiguration | Authentication enforcement, protected endpoint behavior, secure transport compatibility, validation of exposed application interfaces | No application-layer misconfiguration identified |
| A03 Software Supply Chain Failures | Not directly assessed within the scope of this application-layer penetration test | Informational / Out of scope |
| A04 Cryptographic Failures | HTTPS/WSS transport usage, credential exposure review, secure delivery of runtime communication channels | No cryptographic misuse observed at the application boundary |
| A05 Injection | Stored XSS, reflected / DOM XSS, API query injection tests, payload manipulation, schema validation | No exploitable injection identified |
| A06 Insecure Design | Review of authentication model, environment isolation, runtime channel separation, and secret exposure design assumptions | No logical bypass observed |
| A07 Authentication Failures | Unauthenticated access attempts, token replay testing, invalid token rejection, OIDC validation, runtime credential enforcement | Controls functioning as expected |
| A08 Software/Data Integrity Failures | Webhook signature verification and payload integrity protections | Integrity protections validated |
| A09 Logging & Monitoring Failures | Audit log coverage and traceability validation for configuration changes | Audit traceability confirmed for supported resources |
| A10 Mishandling of Exceptional Conditions | Error handling behavior, malformed input handling, pagination boundary testing, oversized input testing | Minor robustness gaps observed |

Overall, testing did not identify any **Critical** or **High severity** vulnerabilities aligned with OWASP Top 10:2025 critical risk categories.

---

# 6. Findings Summary

| ID | Category | Severity | Status |
|----|----------|----------|--------|
| FB-PT-001 | Input Validation / Exceptional Conditions (Pagination) | Low | Open |
| FB-PT-002 | Input Validation / Exceptional Conditions (Oversized Strings) | Low | Open  |

## FB-PT-001 — Pagination Parameter Validation Weakness

**Category:** Input Validation / Exceptional Conditions  
**Severity:** Low (Availability / Robustness)  
**Affected Surface (Representative):** `GET /api/v1/envs/{envId}/audit-logs`

**Description**:

Pagination parameter validation is inconsistent:

- No enforced upper bound on `pageSize` (e.g., `pageSize=999999` is accepted).
- Negative `pageSize` can trigger an unhandled error path resulting in HTTP **500 Internal Server Error**.

**Evidence (Observed)**:

- `pageSize=1 OR 1=1` → HTTP **400 Bad Request** with structured validation error (type enforcement present).
- `pageSize=999999` → HTTP **200 OK** (no maximum limit enforced).
- `pageSize=-1` → HTTP **500 InternalServerError**.

**Impact**:

- Although this endpoint requires authenticated access, an authenticated user (or compromised token) could request extremely large pages, potentially increasing backend load and response sizes under larger datasets (availability risk).
- Negative values triggering HTTP 500 enable repeated exception generation, increasing error logs and potentially degrading service stability (robustness risk).
- No authentication bypass or data access control weakness was identified as part of this behavior.

**Recommendation**:

1) Enforce server-side bounds for pagination (e.g., `1 <= pageSize <= 100` or a configurable maximum).  
2) Reject invalid pagination values (negative, non-integer, overly large) using controlled **400/422** validation errors (avoid HTTP 500).  
3) Optionally clamp oversized values to the configured maximum and add rate limiting for high-frequency list endpoints.

---

## FB-PT-002 — Oversized String Input Can Trigger HTTP 500

**Category:** Input Validation / Exceptional Conditions  
**Severity:** Low (Robustness / Availability)  
**Affected Surface:** Write APIs (observed on a subset of endpoints during create/update operations)

**Description**

During schema/boundary testing, oversized string values submitted in JSON request bodies caused **HTTP 500 Internal Server Error** responses on certain endpoints. Other endpoints correctly returned controlled 4xx validation responses for similar oversized inputs.

**Evidence (Observed)**

- Invalid JSON, missing required fields, and type mismatches consistently returned HTTP **400** with structured validation responses.
- Oversized string inputs:
  - In some cases: returned controlled **4xx** validation errors.
  - In some cases: returned **500 Internal Server Error**.

**Impact**

- Exploitation requires authenticated API access; no authentication bypass was identified.
- The primary risk is robustness and operational noise:
  - repeated invalid requests can generate avoidable server exceptions/logs
  - inconsistent validation behavior complicates client-side error handling
- No measurable service performance degradation was observed during testing; however, returning 500 for validation failures is not best practice and can create availability and monitoring/alerting noise under abuse or misconfiguration.

**Recommendation**

1) Implement consistent server-side maximum lengths for relevant text fields (e.g., name/description/comments) and enforce them uniformly.  
2) For oversized inputs, return controlled **400/422** validation responses (avoid **500**).  
3) Add regression tests for boundary length validation to prevent reintroduction.  
4) Review error handling to ensure oversized inputs never produce unhandled exceptions.

**Suggested Fix Priority**

- Medium priority as a hardening/robustness fix (severity remains Low due to authenticated access requirement and lack of observed service degradation).

---

# 7. Overall Security Assessment

This assessment validates the application-layer security controls described in the **FeatBit Application Security Summary (Interim), Version 1.1**.

Testing covered authentication mechanisms, authorization boundaries, API access controls, runtime evaluation interfaces, real-time communication channels, webhook integrations, input validation behavior, transport security compatibility, secret exposure handling, audit logging, and exception handling.

Across the tested application surfaces, FeatBit demonstrated the following security characteristics:

- Consistent enforcement of authentication requirements across protected interfaces
- Strong server-side authorization controls with project and environment isolation
- Clear separation between runtime evaluation credentials and management API access
- Secure real-time streaming channel authentication with scope-consistent enforcement
- Safe handling of webhook delivery integrity through signature-based verification
- Controlled error responses that avoid disclosure of internal implementation details
- Structured input validation across representative management and write APIs
- Audit logging support for key configuration resources
- Compatibility with secure HTTPS / WSS deployments in self-hosted environments

No **Critical** or **High severity** vulnerabilities were identified during testing.

Two **Low severity** findings were observed:

- **FB-PT-001** — Pagination parameter validation weakness
- **FB-PT-002** — Oversized string input can trigger HTTP 500 responses on certain write APIs

These findings do not enable authentication bypass, privilege escalation, unauthorized data access, or other high-impact security control failures. They primarily represent **robustness and validation consistency issues** that should be remediated as part of ongoing hardening work.

Overall, the FeatBit platform demonstrates a **strong application-layer security posture** with well-defined authentication, authorization, runtime isolation, and integration security controls suitable for production deployment in self-hosted environments, provided that recommended infrastructure-layer security practices are implemented by the deploying party.

This report completes the formal application-layer security assessment referenced in the **FeatBit Application Security Summary (Interim), Version 1.1**.