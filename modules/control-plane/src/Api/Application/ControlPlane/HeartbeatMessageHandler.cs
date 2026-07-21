using System.Collections.Concurrent;
using System.Text.Json;
using Application;
using Application.Caches;
using Application.ControlPlane;
using Domain.ControlPlane;
using Domain.Health;
using Domain.Messages;

namespace Api.Application.ControlPlane;

public class HeartbeatMessageHandler(
    [FromKeyedServices("compositeCache")] ICacheService cacheService,
    ILogger<HeartbeatMessageHandler> logger,
    ILeaseStore leaseStore,
    IConfiguration configuration) : IMessageHandler
{
    private const int DefaultLeaseTtlSeconds = 15;

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    // #99: this handler is registered AddKeyedTransient (a new instance per message), so
    // per-DC cadence state can't live on instance fields — it's tracked process-wide instead.
    // LastHeartbeatTimestampByDcId holds the previous heartbeat's timestamp per DC so the next
    // heartbeat can compute the observed gap; DcIdsWarnedForSlowCadence rate-limits the warning
    // to once per DcId per process so a persistently misconfigured deployment doesn't spam the
    // log on every heartbeat.
    private static readonly ConcurrentDictionary<string, DateTimeOffset> LastHeartbeatTimestampByDcId = new();
    private static readonly ConcurrentDictionary<string, byte> DcIdsWarnedForSlowCadence = new();

    public string Topic => ControlPlaneTopics.PodHeartbeat;

    public async Task HandleAsync(string message)
    {
        logger.LogInformation("Received heartbeat message: {Message}", message);

        try
        {
            var heartBeatMessage = JsonSerializer.Deserialize<HealthMessage>(message, JsonOptions);

            if (!TryValidate(heartBeatMessage, message))
            {
                return;
            }

            await cacheService.UpsertPodHeartbeat(heartBeatMessage!);

            // Under GatedCommit, the heartbeat doubles as live-set membership: persist a
            // DC lease so the control plane can track which DCs are currently live and what
            // versions they have applied. BestEffort keeps today's fire-and-forget behavior.
            if (configuration.GetConsistencyMode() == ConsistencyMode.GatedCommit)
            {
                await UpsertLeaseAsync(heartBeatMessage!);
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to process heartbeat message: {Message}", message);
        }
    }

    private async Task UpsertLeaseAsync(HealthMessage heartBeatMessage)
    {
        var leaseTtlSeconds = configuration.GetValue("ControlPlane:LeaseTtlSeconds", DefaultLeaseTtlSeconds);
        var leaseTtl = TimeSpan.FromSeconds(leaseTtlSeconds);
        var dcId = heartBeatMessage.DcId ?? heartBeatMessage.PodId;

        // #105: only track cadence when a genuine DcId was reported. When DcId is null, dcId above
        // falls back to PodId — a fresh Guid every pod process — so keying the process-wide cadence
        // dictionaries (LastHeartbeatTimestampByDcId / DcIdsWarnedForSlowCadence) off that fallback
        // would grow them unbounded-ish under a persistent DcId-less GatedCommit misconfiguration
        // (a new "DcId" on every pod restart, never reused, never cleaned up). The warning text also
        // targets per-DC cadence tuning, which is meaningless for a fallback PodId anyway.
        if (heartBeatMessage.DcId is not null)
        {
            WarnIfCadenceExceedsLeaseTtl(heartBeatMessage.DcId, heartBeatMessage.Timestamp, leaseTtl);
        }

        var lease = new DcLease
        {
            DcId = dcId,
            Region = heartBeatMessage.Region ?? string.Empty,
            LastHeartbeatAt = heartBeatMessage.Timestamp,
            LeaseExpiresAt = heartBeatMessage.Timestamp + leaseTtl,
            AppliedWatermarks = heartBeatMessage.AppliedWatermarks ?? new Dictionary<Guid, long>()
        };

        await leaseStore.UpsertLeaseAsync(lease);
    }

    /// <summary>
    /// #99: if the gap between this heartbeat and the DC's previous one exceeds the lease TTL,
    /// the lease store already let this DC's lease expire before the next heartbeat renewed it —
    /// the live set flaps, which stalls GatedCommit (the coordinator never sees every configured
    /// DC live at once). This is otherwise only diagnosable by watching leases flap, so warn once
    /// per DcId per process. Cheap by design (dictionary lookups only) since it runs per heartbeat.
    /// </summary>
    private void WarnIfCadenceExceedsLeaseTtl(string dcId, DateTimeOffset timestamp, TimeSpan leaseTtl)
    {
        if (LastHeartbeatTimestampByDcId.TryGetValue(dcId, out var previousTimestamp))
        {
            var gap = timestamp - previousTimestamp;
            if (gap > leaseTtl && DcIdsWarnedForSlowCadence.TryAdd(dcId, 0))
            {
                logger.LogWarning(
                    "Heartbeat cadence for DcId {DcId} exceeds the lease TTL: observed gap between " +
                    "heartbeats was {GapSeconds:F1}s but ControlPlane:LeaseTtlSeconds is {LeaseTtlSeconds}s. " +
                    "The DC's lease is expiring between heartbeats, causing the live set to flap. " +
                    "Lower ControlPlane:HeartbeatIntervalSeconds on that DC's evaluation servers to " +
                    "<= LeaseTtlSeconds/3.",
                    dcId, gap.TotalSeconds, leaseTtl.TotalSeconds);
            }
        }

        LastHeartbeatTimestampByDcId[dcId] = timestamp;
    }

    private bool TryValidate(HealthMessage? heartBeatMessage, string rawMessage)
    {
        if (heartBeatMessage is null)
        {
            logger.LogError("Heartbeat message is null after deserialization: {Message}", rawMessage);
            return false;
        }
        if (string.IsNullOrWhiteSpace(heartBeatMessage.PodId))
        {
            logger.LogError("Pod id is null or empty: {Message}", rawMessage);
            return false;
        }
        if (heartBeatMessage.Timestamp == default)
        {
            logger.LogError("Timestamp is default value: {Message}", rawMessage);
            return false;
        }
        return true;
    }
}
