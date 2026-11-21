# Observability provider API

An environment can store multiple named connections to Prometheus-compatible services and Azure Monitor Logs. Use `/api/v1/envs/{envId}/observability-providers` to create (`POST`) or list (`GET`) connections. Append `/{id}` to read (`GET`), edit (`PUT`), or soft-delete (`DELETE`) a connection. Reads require `CanAccessEnv`. Writes also require `UpdateEnvSettings`.

## Configure credential encryption

Before saving authenticated connections, inject a dedicated key ring into the FeatBit API through your deployment's secret manager. Set `ReleaseHealth__Credentials__ActiveKeyId` to a key ID such as `v1`, and `ReleaseHealth__Credentials__Keys__v1` to a Base64-encoded, randomly generated 32-byte key. All API replicas need the same key ring. The API validates a configured ring at startup. Deployments with no ring can use Prometheus connections with `none` authentication.

To rotate the root key, install the new key on every replica before switching the active ID. Retain old keys while stored credentials or backups still depend on them.

## Create a connection

A Prometheus-compatible connection can use `none`, `bearer_token`, or `basic` authentication. Basic authentication takes a `username` in `authentication` and a `password` in `secretUpdate`. For `none`, omit `secretUpdate` when creating the connection.

```json
{
  "name": "Production Prometheus",
  "providerType": "prometheus-compatible",
  "providerConfig": { "endpoint": "https://prometheus.example.com" },
  "authentication": { "type": "bearer_token" },
  "secretUpdate": { "operation": "replace", "token": "<token>" }
}
```

Azure Monitor Logs uses a Log Analytics workspace ID and a Microsoft Entra application with client-secret authentication.

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

## Edit or remove a connection

`PUT` accepts the full configuration plus `expectedVersion` from the latest read. Use `"secretUpdate": { "operation": "keep" }` to retain an existing credential, or supply `replace` with the new value. Changing the endpoint of an authenticated Prometheus connection requires `replace` with a credential for the new endpoint. When switching to Prometheus `none`, use `remove` to clear the previous credential. Responses expose the authentication mode and secret state. Every successful edit advances `version`. A change to the provider, destination, or authentication identity also advances `revision`.

An active name must be unique within its environment. A duplicate name or stale version returns HTTP 409. Deleting a connection removes it from reads, clears its encrypted credential, and releases the name for reuse.
