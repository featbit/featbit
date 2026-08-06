# Flag and Segment Change Reliability Enhancement

> **Status: Draft proposal.** Delivery semantics, compatibility strategy, and phasing remain open to change until this proposal is reviewed.
>
> Scope: feature-flag and segment changes from the API through the configured message provider and ELS fanout to connected clients. End-user, usage, insight, and webhook messages are excluded.

## 1. Goal

Make feature-flag and segment changes reliable across two boundaries:

1. **Message delivery:** the API must know whether a change message was delivered. If delivery fails, the corresponding data change must be rolled back and the API must return an actionable error for the UI to display.
2. **Message processing and fanout:** ELS must process delivered changes and reliably transmit them to connected clients over WebSocket.

These are separate guarantees. A broker acknowledgement does not prove that ELS processed the message, and a successful WebSocket send does not prove that a client received or applied the change.

## 2. Current Risks

- The Kafka producer uses fire-and-forget `Produce()` and returns `Task.CompletedTask` before delivery is known.
- Producer exceptions and delivery failures are logged but not propagated, so API commands can report success after publication fails.
- Feature-flag and segment persistence, audit records, cache updates, revisions, and message publication do not currently form one atomic operation.
- A process crash can occur after persistence but before publication.
- The same logical change can be delivered more than once after retries or consumer recovery.
- ELS fanout has no end-to-end client acknowledgement that proves a connected SDK applied a change.

## 3. Required Delivery Contract

For a synchronous API change request:

- Return success only when the data change and its required publication satisfy the selected consistency design.
- On a confirmed publication failure, roll back the corresponding data change and return a non-success API response with a stable error code that the UI can translate into an error message.
- Do not expose broker errors, connection strings, topics, payloads, or other infrastructure details to the client.
- Treat a timeout or lost acknowledgement as an **unknown outcome**, not a confirmed failure. The broker may have accepted the message even when the API did not receive the acknowledgement.
- Give every logical change a stable `change_id`; retries must reuse it, and consumers must be idempotent.

The contract must apply consistently to feature flags and segments and must define equivalent acknowledgement semantics for every supported provider. Provider behavior may differ internally, but `IMessageProducer.PublishAsync` must not report success before the provider-specific delivery boundary is reached.

## 4. Kafka Producer Changes

Change [`KafkaMessageProducer`](../../../modules/back-end/src/Infrastructure/MQ/Kafka/KafkaMessageProducer.cs) so callers can observe delivery:

1. Use `ProduceAsync`, or bridge the delivery callback into the returned task.
2. Complete `PublishAsync` only after Kafka acknowledges delivery.
3. Propagate delivery failures instead of only logging them and returning `Task.CompletedTask`.
4. Explicitly configure `acks=all` and `enable.idempotence=true`; validate compatible producer settings at startup.
5. Preserve a stable `change_id` across retries so duplicate deliveries are safe.
6. Bound the wait with cancellation and a documented timeout policy, while preserving the distinction between confirmed failure and unknown outcome.

Feature-flag and segment changes are relatively infrequent, so waiting for a delivery acknowledgement should have negligible throughput impact. Tests must cover successful delivery, broker rejection, timeout or unknown outcome, cancellation, and duplicate publication.

## 5. Persistence and Rollback Design

The requested UI behavior requires a failed command to leave no corresponding durable change. The current flow cannot guarantee that by merely throwing from `PublishAsync`: repositories save independently, and notification handlers also update caches, audit logs, and revisions.

Implementation therefore requires an explicit application-level transaction boundary that includes all reversible database writes. Cache mutation, webhooks, and other irreversible side effects must run only after the selected commit point or have compensating behavior.

A naive database-then-Kafka or Kafka-then-database sequence is still a dual-write problem:

- Persist then publish leaves a crash window in which data exists without a message.
- Publish then persist can expose a message whose database transaction later rolls back.
- A delivery timeout can be ambiguous: rolling back may leave ELS processing a message for a change that no longer exists.

Before implementation, choose and document one of the following consistency models.

### Option A: Synchronous rollback semantics

Hold the database transaction open while publishing, commit only after confirmed broker delivery, and roll back on confirmed delivery failure. Return an error to the UI when rollback succeeds.

This matches the requested interaction but does not eliminate the distributed transaction gap. Commit failure after broker acknowledgement and ambiguous publication outcomes still require reconciliation. ELS must tolerate a message whose corresponding database commit is absent or delayed.

### Option B: Transactional outbox

Write the domain change and an outbox record in the same database transaction. A background publisher retries until the broker acknowledges delivery, then marks the outbox record as delivered.

```text
database transaction:
  save feature-flag or segment change
  insert outbox message with stable change_id

background publisher:
  publish outbox message
  await provider acknowledgement
  mark outbox message delivered
```

This provides crash-safe eventual, at-least-once delivery and is the recommended reliability model. ELS must process duplicate `change_id` values idempotently.

The outbox changes the user-visible contract: the API reports success after durable outbox acceptance, not after broker delivery, and a later broker outage does not roll back the accepted data change. If rollback on broker failure and an immediate UI error are strict product requirements, choose Option A and accept its residual dual-write risk, or introduce a more complex workflow with a visible `pending` state and asynchronous confirmation.

## 6. Message Envelope and Idempotency

Use a versioned envelope for both feature-flag and segment changes:

```text
schema_version
change_id
change_type
occurred_at
payload
```

Deploy consumers that accept both the existing raw payload and the new envelope before switching producers. ELS must deduplicate by `change_id` or make every processing step naturally idempotent. Deduplication state must have a bounded retention policy based on the maximum retry and replay window.

Do not use `change_id`, flag keys, segment IDs, environment IDs, or connection IDs as metric attributes.

## 7. ELS Processing and WebSocket Fanout

**Status: follow-up design required.** This workstream is independent from API-to-provider delivery and should not block the first producer correction.

Initial direction:

- Record distinct outcomes for broker consume, payload validation, state update, fanout targeting, and socket send.
- Do not commit or settle a consumed message until required ELS processing succeeds. Define retry and dead-letter behavior for permanent failures.
- Make processing idempotent by `change_id` before enabling retries.
- Aggregate fanout target, success, and failure counts once per change rather than recording connection identifiers.
- Define bounded retry behavior for transient socket send failures without blocking all other clients behind one slow connection.
- Preserve version or revision information so reconnecting clients can detect stale state and perform a full synchronization.
- Decide whether reliability ends at successful server-side `SendAsync`, receipt by the SDK, or application by the SDK. The latter two require protocol-level client acknowledgements.
- Treat disconnected clients separately: WebSocket reliability cannot guarantee delivery while a client is offline, so reconnect and full-sync behavior remains the source of convergence.

## 8. Error Handling and User Experience

Define stable API error codes such as `change_delivery_failed` and `change_delivery_unknown`. The UI should display localized guidance and keep the edited form available for retry.

A retry after an unknown outcome must reuse the original `change_id` where possible. The UI must not claim that a change was rolled back when the server cannot prove the publication outcome or when compensation failed.

## 9. Observability

Expose bounded signals for:

- persistence and rollback outcomes;
- provider publication outcomes and duration;
- outbox age, retries, and backlog if Option B is selected;
- ELS consume, processing, and settlement outcomes;
- fanout target, success, failure, and duration;
- last successful propagation age.

Correlate logs and traces with `change_id`, but keep it out of metric attributes. Telemetry export failure must never alter the change-delivery result.

## 10. Rollout

1. Define the selected consistency model and API error contract.
2. Add the versioned envelope and deploy backward-compatible ELS consumers.
3. Make ELS processing idempotent.
4. Correct provider acknowledgement and failure propagation, starting with Kafka.
5. Add the transaction or outbox persistence boundary.
6. Update API endpoints and UI error handling.
7. Add ELS settlement, retry, and fanout reliability behavior.
8. Remove legacy raw-message production after the compatibility window.

## 11. Definition of Done

- The API cannot report confirmed delivery before the configured provider acknowledges it.
- Confirmed delivery failure produces the behavior defined by the selected consistency model and a stable UI-facing error.
- Process termination at every persistence and publication boundary is covered by integration tests.
- Retries and replay do not apply a logical change more than once.
- ELS processing failures follow a documented retry and settlement policy.
- Connected and reconnecting client convergence guarantees are documented and tested.
- Dashboards distinguish persistence, publication, processing, and fanout failures without high-cardinality attributes.
