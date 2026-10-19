# Workspace audit logs and IAM

This change adds IAM events only. Organization settings, webhooks, relay proxies,
access tokens, experiments and workspace settings are not newly audited.
Existing feature flag and segment history remains available.

## Query contract

`GET /api/v1/audit-logs` always constrains reads to the authenticated workspace
context. No environment means all organizations and environments in that
workspace. Optional `envId`, `refType`, `refId`, `creatorId`, `query`, `from`, `to`,
`pageIndex` and `pageSize` narrow the result. There is no scope or crossEnvironment
parameter. Workspace and organization IDs are not accepted as query parameters.

The original `GET /api/v1/envs/{envId}/audit-logs` URL remains available through
an environment-specific controller overload. It uses the same query and access
checks, with the route envId taking precedence over a query envId. The removed
`crossEnvironment` parameter does not broaden this environment endpoint.

The global page never sends envId and has no environment selector. Resource
history supplies the resource's environment, type and ID. Shared-segment history
uses its workspace-owned identity and the same workspace membership check. Actor options use `/api/v1/audit-logs/actors` with the same scope
checks and resource filters.

All authenticated workspace members can read the workspace's audit logs and
actor options without a dedicated IAM permission or membership in every organization.
User membership and environment ownership are checked against the requested workspace.
Service tokens are restricted to their owning organization's workspace; personal
tokens additionally require their creator's workspace membership. Storage queries
always constrain workspace ID, including resource-specific history.

## IAM events and presentation

The MediatR IAM audit behavior wraps group and policy create/update/delete,
policy cloning/statements, member additions/removals and direct policy/group
assignments. Profile name/email changes produce Member events in each organization
the user belongs to, with workspace-only events for memberships without an
organization. Ownership comes from memberships rather than request headers.
Snapshots whitelist identity, description, statements and relation
references; no password, initial password or token is serialized. Initial
permission assignment records its source. Deletions preserve removed relations.
Nested member removals share a transaction. Unchanged
snapshots, including repeated relationship additions, do not emit events.

The existing table uses Actor and Resource columns, inline changes, and the
read-only raw diff dialog. IAM resources display name and the same RN as their
management pages: `member/<email>`, `group/<name>`, `policy/<key>`. Organization
context is resolved at read time; deleted parents may have no display name. Flag/segment links are not generated using a different
currently selected organization's/environment's context. Statement matching
uses statement IDs and ignores set ordering.

## Storage and rollout

This implementation targets PostgreSQL only. MongoDB IAM auditing, workspace
queries, actor filtering and migration are deferred. Existing MongoDB IAM writes
retain their previous behavior without the new audit pipeline.

Apply `infra/postgresql/docker-entrypoint-initdb.d/v6.0.1.sql` before
starting the updated server. New-install initialization also includes this
version. The PostgreSQL script is transactional.
Verified parent ownership is copied to each historical record. Unresolvable
ownership stops migration instead of assigning an arbitrary tenant or deleting
history. Restore verified ownership and rerun. Do not fabricate historical IAM
events from current state. Take a normal database backup before deployment.

The only new audit table columns are `workspace_id` and `organization_id`;
`env_id` becomes nullable and other existing columns retain their definitions.
IAM operations such as `AddGroupMember` and `ClonePolicy` use the existing
`operation` column. Cloning source lives in the existing `data_change` JSON
alongside the before/after snapshots; the API exposes it as top-level `source`
and returns only `previous` and `current` inside `dataChange`. Actor names are resolved
from `creator_id` at read time; deleted actors display Unknown.

Workspace ID is mandatory. Organization ID and environment ID are nullable;
environment ownership requires an organization. Shared segments belong to their
workspace and are not copied into each environment's history. PostgreSQL indexes cover workspace/time and workspace/resource history.
The workspace/resource index replaces `ix_audit_logs_env_id_ref_id_created_at`;
no separate workspace/environment index is added. Timestamp plus event ID supplies deterministic ordering.

IAM mutations and audit writes use one PostgreSQL serializable transaction.
Errors abort the operation; there is no best-effort fallback that can silently
omit an event.
PostgreSQL commit recovery uses the existing primary keys of the written audit logs to avoid replaying
an operation whose commit succeeded but acknowledgement was lost.

The change does not deploy these migrations to a running database. Other
resource write paths retain their existing transaction semantics.
