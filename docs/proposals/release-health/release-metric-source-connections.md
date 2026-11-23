# Release metric source connection API

A `ReleaseMetricSourceConnection` identifies where an environment's release metrics get their data. For example, one connection can point to a production Prometheus service that supplies both the HTTP error rate and P95 latency for a release. Experimentation metrics are defined separately. [Release Health proposal](./README.md)

An environment can store multiple named connections of the same `providerType`. Use `/api/v1/envs/{envId}/release-metric-source-connections` to create (`POST`) or list (`GET`) connections. Append `/{id}` to read (`GET`), edit (`PUT`), or soft-delete (`DELETE`) a connection. Reads require `CanAccessEnv`. Writes also require `UpdateEnvSettings`.

## Create a connection

Send public settings in `providerConfig` and `authentication`. For a new connection using one of the credential types below, include a top-level `secretUpdate` with `operation` set to `replace` and a nonempty value for the matching field. FeatBit encrypts the credential before saving it. CRUD responses expose only public information. Credential writes accept strings or `null` for public settings. For a connection without credentials, send both public objects and omit `secretUpdate`. Prometheus accepts `{"type":"none"}` or `{}` as its `authentication` object.

| Provider and authentication | Public provider fields | Public authentication fields | Write-only field in `secretUpdate` |
| --- | --- | --- | --- |
| Prometheus-compatible, Bearer | `endpoint` | `type` | `token` |
| Prometheus-compatible, Basic | `endpoint` | `type`, `username` | `password` |
| Azure Monitor, client secret | `workspaceId` | `mode`, `tenantId`, `clientId` | `clientSecret` |

To create a Prometheus connection using a Bearer token, send this `POST` body. Use a public endpoint URL without embedded credentials, a query string or a fragment.

```json
{
  "name": "Production Prometheus",
  "providerType": "prometheus-compatible",
  "providerConfig": { "endpoint": "https://prometheus.example.com" },
  "authentication": { "type": "bearer_token" },
  "secretUpdate": { "operation": "replace", "token": "<bearer-token>" }
}
```

For Basic authentication, use the same `name`, `providerType` and `providerConfig` fields, and supply these two objects.

```json
{
  "authentication": { "type": "basic", "username": "metrics-reader" },
  "secretUpdate": { "operation": "replace", "password": "<password>" }
}
```

For an Azure Monitor Logs connection, submit the Log Analytics workspace ID, Microsoft Entra application details and client secret together.

```json
{
  "name": "Production logs",
  "providerType": "azure-monitor",
  "providerConfig": { "workspaceId": "10000000-0000-4000-8000-000000000001" },
  "authentication": {
    "mode": "ClientSecret",
    "tenantId": "20000000-0000-4000-8000-000000000002",
    "clientId": "30000000-0000-4000-8000-000000000003"
  },
  "secretUpdate": { "operation": "replace", "clientSecret": "<client-secret>" }
}
```

## Credential status in responses

Create, update, detail and list responses include a top-level `secretState` on each connection. Its value is `configured` when the connection has a stored credential, or `not_configured` when it has none. Removing a credential returns the state to `not_configured`. Older connections can have an authentication type such as `basic` and still return `not_configured`.

The API determines this state from the presence of the protected value without decrypting it. The UI can show “Configured” and a replacement action while leaving the credential input empty.

## Edit or remove a connection

Send `PUT` to the connection's `/{id}` URL. Omitted top-level fields retain their stored values. To rename a connection and keep its current credential, send just the name.

```json
{ "name": "Production metrics" }
```

A supplied `providerConfig` or `authentication` replaces the entire corresponding object. This request changes the path on the original Prometheus host and keeps its token. FeatBit verifies the stored credential against the old settings and encrypts it again for the new settings. If the scheme, host or effective port changes, supply a replacement Bearer token or Basic password.

```json
{ "providerConfig": { "endpoint": "https://prometheus.example.com/team-a" } }
```

To explicitly keep a configured credential, send `"secretUpdate": { "operation": "keep" }`. This requires an existing credential for the same provider and authentication method. FeatBit decrypts that credential and re-encrypts it with the active key, even if the public settings are unchanged. Older connections saved without a credential remain readable and editable. Use `replace` to configure their first credential.

To rotate a Bearer token, send only the new credential. Use `password` or `clientSecret` for the other authentication methods.

```json
{ "secretUpdate": { "operation": "replace", "token": "<new-bearer-token>" } }
```

When switching to a different authentication method that requires a credential, include the new `authentication` object and its matching `replace` operation in the same update. An empty or mismatched credential, or an invalid `keep`, returns HTTP 400. The previously saved settings and credential remain available if the update fails.

To revoke a credential, send `{ "secretUpdate": { "operation": "remove" } }`. To switch Prometheus to unauthenticated access and clear the credential in the same update, send both fields.

```json
{
  "authentication": { "type": "none" },
  "secretUpdate": { "operation": "remove" }
}
```

A concurrent edit can return HTTP 409. Read the latest connection details before retrying the intended change.

Connections in the same environment can share a name. Use the connection ID for reads, updates and soft deletion. Soft deletion clears the saved credential and hides the connection from list and detail requests.

## Configure the deployment key ring

Inject `ReleaseHealth__CredentialKeyRing` into each API instance as a single JSON string. Generate each key from 32 cryptographically random bytes and Base64-encode those bytes. Choose a key ID of 1 to 64 ASCII letters, digits, hyphens or underscores. In this example, replace the placeholder with the generated value.

```json
{ "active": "v1", "keys": { "v1": "<base64-encoded 32-byte key>" } }
```

FeatBit encrypts the complete credential JSON using AES-256-GCM and saves the key ID with the ciphertext in `protected_credential`. New writes use the active key. Decryption uses the saved key ID and verifies the connection scope, provider and public settings. Store and back up the key ring through the deployment secret manager, separately from the database. Use the same ring on every instance that reads or writes credentials.

The API can start with the setting absent. Reads and credential-free connections still work. Operations that require encryption or decryption return HTTP 422 when the required key is unavailable. A malformed configured ring prevents startup.

To rotate the deployment key, roll out each change to all instances before starting the next step.

1. Generate a new key under a new ID, such as `v2`. Distribute both keys with `active` still set to `v1`.
2. Set `active` to `v2` and retain `v1` in `keys`. New credentials and replacements now use `v2`.
3. Re-encrypt credentials that still use `v1`. In batches, send `PUT /api/v1/envs/{envId}/release-metric-source-connections/{id}` with `{ "secretUpdate": { "operation": "keep" } }` for each affected connection. This preserves each provider credential without asking its owner for the value. A rename that omits `secretUpdate` preserves the existing ciphertext.
4. Remove `v1` only after all affected credentials have been re-encrypted and backups that depend on `v1` have completed their retention period.
