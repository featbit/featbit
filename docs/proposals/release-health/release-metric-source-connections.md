# Release metric source connection API

A `ReleaseMetricSourceConnection` identifies where an environment's release metrics get their data. For example, one connection can point to a production Prometheus service that supplies both the HTTP error rate and P95 latency for a release. Experimentation metrics are defined separately. [Release Health proposal](./README.md)

An environment can store multiple named connections of the same `providerType`. Use `/api/v1/envs/{envId}/release-metric-source-connections` to create (`POST`) or list (`GET`) connections. Append `/{id}` to read (`GET`), edit (`PUT`), or soft-delete (`DELETE`) a connection. Reads require `CanAccessEnv`. Writes also require `UpdateEnvSettings`.

## Create a connection

Create and update requests take two JSON objects, `providerConfig` and `authentication`. Both can be empty or partially filled. Their fields are returned by the API, so only the public fields listed below are accepted. Each field takes a scalar value or `null`. Saving a connection does not contact the provider.

| `providerType` | Public fields in `providerConfig` | Public fields in `authentication` |
| --- | --- | --- |
| `prometheus-compatible` | `endpoint` | `type`, `username` |
| `azure-monitor` | `workspaceId` | `mode`, `tenantId`, `clientId` |

For example, a Prometheus connection using basic authentication can include the username. Keep embedded credentials, query strings and fragments out of the endpoint because it is returned to readers.

```json
{
  "name": "Production Prometheus",
  "providerType": "prometheus-compatible",
  "providerConfig": { "endpoint": "https://prometheus.example.com" },
  "authentication": { "type": "basic", "username": "metrics-reader" }
}
```

This Azure Monitor Logs example identifies a Log Analytics workspace and a Microsoft Entra application.

```json
{
  "name": "Production logs",
  "providerType": "azure-monitor",
  "providerConfig": { "workspaceId": "10000000-0000-4000-8000-000000000001" },
  "authentication": {
    "mode": "ClientSecret",
    "tenantId": "20000000-0000-4000-8000-000000000002",
    "clientId": "30000000-0000-4000-8000-000000000003"
  }
}
```

## Edit or remove a connection

Send the same fields with `PUT` to replace the name and connection settings. Connection settings contain only non-sensitive values.

Connections in the same environment can share a name. Use the connection ID for reads, updates and soft deletion. Soft deletion hides that connection from list and detail requests.
