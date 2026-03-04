https://owasp.org/Top10/2025/

# FeatBit Application-Layer Penetration Test Report
(Aligned with FeatBit Application Security Summary v1.1)

Product: FeatBit (Self-Hosted Edition)  
Version Tested: [vX.X.X]  
Assessment Window: [Start – End Date]  
Report Date: [YYYY-MM-DD]  
Prepared by: FeatBit Inc.  

This report represents the formal application-layer assessment referenced in the "FeatBit Application Security Summary (Interim), Version 1.1".

---

# 1. Objective

The objective of this assessment is to validate the effectiveness of application-layer security controls described in the "FeatBit Application Security Summary (Interim), Version 1.1".

This assessment focuses on identifying potential Critical and High-risk vulnerabilities within the application layer of FeatBit (Self-Hosted Edition).

Testing is aligned with OWASP Top 10:2025 and contemporary application security best practices.

Infrastructure, operating system, network-layer security, and source-code review are explicitly out of scope.

---

# 2. Scope Alignment with Security Summary

This assessment scope is fully aligned with the boundaries defined in:"FeatBit Application Security Summary (Interim), Version 1.1".

The scope of this assessment reflects the application-layer responsibilities as defined in Section 2 of the Security Summary.

## 2.1 In Scope (Application Layer)

The following application-layer components and control domains were included in testing:

- FeatBit Dashboard (web front-end for user operations and administration)
- FeatBit API service (REST APIs for dashboard and feature/configuration management)
- FeatBit evaluation service (SDK-facing evaluation paths, including real-time channel behavior)
- FeatBit data analytics service (insight retrieval and analytics APIs)
- FeatBit SDK behavior and integration security boundaries (application-layer perspective)
- Integration capabilities, including webhook-based outbound integrations and API-token-based integrations
- Authentication and session management controls
- Authorization and role-based access control (RBAC)
- Administrative operation protections
- Feature flag data access isolation by project/environment context

## 2.2 Out of Scope (Customer-Managed Infrastructure Layer)

Consistent with the Security Summary, the following elements were not included in this assessment:

- Host, OS, network perimeter, and firewall controls
- Kubernetes/VM/container hardening
- Database platform patching, encryption-at-rest implementation, and key management
- WAF, SIEM, and infrastructure monitoring policy configuration

FeatBit is deployed in a customer-controlled self-hosted model; therefore, infrastructure and platform controls remain under customer ownership.

---

# 3. Methodology

This assessment was conducted as an application-layer security evaluation to validate the controls described in the "FeatBit Application Security Summary (Interim), Version 1.1".

Testing methodology aligns with OWASP Top 10:2025 risk categories where applicable to FeatBit components, as outlined in Section 9 of the Security Summary.

## 3.1 Testing Approach

The testing approach included:

- Black-box dynamic testing against exposed application interfaces
- Authenticated testing using multiple user roles
- Manual authorization and privilege boundary validation
- Injection payload simulation (aligned with OWASP Injection category)
- Token and session manipulation testing (Authentication risk category)
- Cross-project and cross-environment isolation validation (Access Control category)
- WebSocket authentication and scope validation
- Webhook integrity and signature validation
- Error-handling behavior analysis (Exceptional Conditions category)

## 3.2 Testing Accounts

The following account types were used during testing:

- Administrator account
- Standard user account
- Unauthenticated access attempts

This ensured validation of role-based access boundaries and privilege enforcement.

## 3.3 Tooling

Primary tooling used during the assessment included:

- OWASP ZAP (used as an interception proxy and request manipulation tool)
- Manual HTTP request inspection and replay
- Browser developer tools for request inspection and token handling validation

Security testing was primarily conducted through manual validation of authentication, authorization, and API access control behaviors, with OWASP ZAP assisting in request interception and modification.

All testing activities were conducted against a controlled FeatBit deployment environment.

## 3.4 Environment

All testing was conducted against a controlled self-hosted deployment
environment consistent with the architecture described in
Section 3 of the Security Summary.

Testing was isolated from production customer workloads.

---

# 4. Control Validation by Security Domain

---

# 4.1 Authentication & Session Security
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

# 4.2 Authorization & RBAC Enforcement
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

# 4.3 API, SDK & Real-Time Channel Security

This section evaluates security controls applied to FeatBit’s programmatic access channels.

These interfaces enable automated system interaction, including CI/CD pipelines, infrastructure automation, SDK runtime evaluation, and integration events.

Testing focuses on authentication enforcement, authorization boundaries, environment isolation, and integrity protections across these channels.

---

## 4.3.1 Programmatic Management API (Access Token Enforcement)

FeatBit provides programmatic management APIs that can be invoked using access tokens.  
These APIs enable automated interaction with the platform, including CI/CD pipelines, infrastructure-as-code workflows, command-line tooling, automation agents, integration connectors, and other non-interactive access patterns.

Testing focused on validating authentication enforcement and authorization boundaries for these programmatic access channels.

### Action

The following security validations were performed:

- Attempted access to management APIs without authentication
- Attempted access using invalid or malformed access tokens
- Attempted privileged operations using limited-scope tokens
- Verified that SDK or evaluation credentials cannot access management APIs

### Representative Endpoints Tested

```
GET  /api/v1/projects
POST /api/v1/projects/{projectId}/flags
DELETE /api/v1/projects/{projectId}/segments/{segmentId}
PUT  /api/v1/workspaces/{workspaceId}/settings
```

These endpoints represent common management operations including project listing, feature flag creation, configuration deletion, and workspace-level configuration updates.

### Observed Behavior

Testing results were consistent across the evaluated endpoints:

- Requests without authentication tokens returned HTTP **[401/403]**.
- Requests using invalid or tampered tokens returned HTTP **[401]**.
- Limited-scope tokens attempting privileged operations returned HTTP **[403]**.
- Administrative tokens successfully executed authorized operations and returned HTTP **[200/201]**.
- SDK environment credentials were rejected when used against management API endpoints.

No cases were identified where programmatic management APIs could be accessed without proper authentication or authorization.

### Conclusion

Programmatic management APIs enforce authentication through access tokens and apply server-side authorization checks to privileged operations.

Access tokens are validated prior to request processing, and authorization boundaries prevent limited-scope tokens from executing administrative actions.

SDK evaluation credentials cannot be used to invoke management APIs, ensuring separation between runtime evaluation interfaces and management operations.

---

## 4.3.2 SDK Evaluation Interface Security

FeatBit SDKs retrieve feature flag definitions and evaluation results through dedicated runtime interfaces.

These interfaces are designed for application runtime usage and rely on environment-scoped credentials rather than user authentication.

### Action

The following scenarios were evaluated:

- Access to evaluation endpoints without environment credentials
- Attempted cross-environment access using environment secrets
- Use of evaluation credentials against management APIs
- Submission of malformed input through SDK event ingestion endpoints

### Representative Endpoints Tested

```
GET  /evaluation/flags
POST /insights/events
POST /evaluation/context
```

### Observed Behavior

- Requests without valid environment credentials were rejected.
- Environment credentials were restricted to their associated environment scope.
- Evaluation credentials could not access management APIs.

### Conclusion

SDK evaluation interfaces enforce environment-scoped authentication and prevent misuse outside their intended runtime scope.

---

## 4.3.3 Real-Time Streaming Channel Security

FeatBit supports real-time configuration delivery through streaming channels used by SDKs to receive feature flag updates.

### Action

The following validations were performed:

- WebSocket connection attempts without authentication
- Attempted subscription to unauthorized project/environment scopes
- Invalid token usage during streaming connection establishment

### Observed Behavior

- Unauthenticated connection attempts were rejected.
- Streaming channels enforce authentication during handshake.
- Stream subscriptions remain limited to the authenticated scope.

### Conclusion

Real-time delivery channels enforce authenticated connection establishment and scope-consistent subscription behavior.

---

## 4.3.4 Webhook Integration Security

FeatBit supports outbound webhook integrations to notify external systems of configuration changes and events.

### Action

Testing included validation of webhook delivery integrity protections, including:

- Verification of webhook signature headers
- Tampering with webhook payloads while preserving the original signature
- Replay validation behavior

### Observed Behavior

Webhook payload tampering resulted in signature validation failure.

### Conclusion

Webhook integrations support payload integrity verification through HMAC-based signature validation.

---

# 4.4 Injection & Input Validation
(Summary Section 9 – Injection Control Validation)

Payloads tested:

' OR 1=1 --  
<script>alert(1)</script>  
../../etc/passwd  

Observed:

- SQL injection: Not exploitable
- Reflected XSS: Properly sanitized
- Path traversal: Blocked

Conclusion:
Structured input validation functioning as expected.

---

# 4.5 Cryptographic & Transport Security
(Summary Section 7 Validation)

Action:
- Verified HTTPS enforcement
- Attempted downgrade to HTTP
- Reviewed transport configuration

Result:
[HTTPS enforced]

Conclusion:
Transport encryption validated at application layer.

---

# 4.6 Data Protection & Secret Exposure
(Summary Section 7 Validation)

Action:
- Reviewed logs for token leakage
- Inspected API responses for secret exposure

Result:
No sensitive credential exposure observed.

Conclusion:
No unintended token leakage detected.

---

# 4.7 Logging & Auditability
(Summary Section 8 Validation)

Action:
- Modified feature flag
- Deleted segment
- Changed role

Verification:
Audit logs recorded actions appropriately.

Conclusion:
Core governance events logged.

---

# 4.8 Exception Handling & Error Exposure

Action:
- Triggered malformed JSON
- Triggered invalid input
- Triggered unauthorized operations

Observed:
No stack trace or sensitive internal details exposed.

Conclusion:
Error handling does not leak internal implementation details.

---

# 5. OWASP Top 10:2025 Mapping Summary

| Category | Status |
|-----------|---------|
| A01 Broken Access Control | Validated |
| A02 Security Misconfiguration | Validated |
| A03 Software Supply Chain Failures | Reviewed (Application Layer Scope) |
| A04 Cryptographic Failures | Validated |
| A05 Injection | Validated |
| A06 Insecure Design | No logical bypass observed |
| A07 Authentication Failures | Validated |
| A08 Software/Data Integrity Failures | Validated |
| A09 Logging & Alerting Failures | Validated |
| A10 Mishandling of Exceptional Conditions | Validated |

---

# 6. Findings Summary

| ID | Category | Severity | Status |
|----|----------|----------|--------|
| FB-PT-001 | Broken Access Control | None | Validated |
| FB-PT-002 | Injection | None | Validated |

(No Critical or High findings identified during assessment window.)

---

# 7. Conclusion

This assessment validates the application-layer controls described in the
FeatBit Application Security Summary.

No Critical or High-risk vulnerabilities were identified during testing.

FeatBit demonstrates:

- Enforced authentication
- Scoped authorization boundaries
- Structured input validation
- Secure real-time communication handling
- Proper error handling behavior
- Audit traceability for governance events

This report completes the formal assessment referenced in the Interim Summary.