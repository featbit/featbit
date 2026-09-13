using Api.Infrastructure.Caches;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Api.Application.ControlPlane;

/// <summary>
/// Diagnostic check reporting the control plane's cross-DC posture: which peer datacenter Redis
/// links are currently connected, and whether this replica holds the leader lease.
/// </summary>
/// <remarks>
/// <para>
/// The control plane is designed to survive a peer DC being unreachable: <c>CompositeRedisCacheService</c>
/// logs the failure, records it, and continues so that a remote outage cannot take down the local
/// write path. That is the right behavior and it is also why a half-broken control plane looks
/// perfectly healthy from the outside — readiness passes, requests succeed, and one datacenter
/// silently stops receiving flag changes. This check is the direct answer to that.
/// </para>
/// <para>
/// It performs NO I/O. <c>IConnectionMultiplexer.IsConnected</c> is live state maintained by
/// StackExchange.Redis' own background connection management — the same signal
/// <c>CacheReconciler</c> polls to decide when to backfill a returning DC. Touching
/// <c>.Connection</c> materializes the lazy multiplexer, which is safe here because every per-DC
/// client is built with <c>abortConnect=false</c> precisely so that a first touch against an
/// unreachable peer cannot throw or cache a permanent failure.
/// </para>
/// <para>
/// Dependencies are resolved optionally. The per-DC connection list only exists when the Redis
/// cache path is configured and leader election is only registered when enabled, so a hard
/// constructor dependency would turn a supported configuration into a startup crash.
/// </para>
/// <para>
/// Diagnostics-tagged only. An unreachable peer DC must NEVER fail this pod's readiness — doing so
/// would escalate a single-DC outage into a control-plane outage, which is exactly the failure mode
/// the swallow-and-continue design exists to prevent. Promoting it is follow-up F3.
/// </para>
/// </remarks>
public sealed class ControlPlaneDiagnosticHealthCheck : IHealthCheck
{
    private readonly IReadOnlyList<DcRedisConnection>? _dcs;
    private readonly ILeaderElection? _leaderElection;

    public ControlPlaneDiagnosticHealthCheck(IServiceProvider serviceProvider)
    {
        _dcs = serviceProvider.GetService(typeof(IReadOnlyList<DcRedisConnection>))
            as IReadOnlyList<DcRedisConnection>;
        _leaderElection = serviceProvider.GetService(typeof(ILeaderElection)) as ILeaderElection;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var data = new Dictionary<string, object>();

        if (_leaderElection is not null)
        {
            data["is_leader"] = _leaderElection.IsLeader;
            data["instance_id"] = _leaderElection.InstanceId.ToString();
        }

        if (_dcs is null || _dcs.Count == 0)
        {
            data["dc_count"] = 0;

            return Task.FromResult(HealthCheckResult.Healthy(
                "No per-DC Redis connections are configured.", data));
        }

        var unreachable = new List<string>();
        var localUnreachable = false;

        foreach (var dc in _dcs)
        {
            bool connected;
            try
            {
                connected = dc.Client.Connection.IsConnected;
            }
            catch (Exception ex)
            {
                // A DC whose connection state cannot even be READ is strictly worse than one
                // reporting disconnected, so it is reported as unreachable rather than skipped.
                connected = false;
                data[$"dc.{dc.DcId}.error"] = ex.GetType().Name;
            }

            data[$"dc.{dc.DcId}.connected"] = connected;
            data[$"dc.{dc.DcId}.is_local"] = dc.IsLocal;

            if (connected)
            {
                continue;
            }

            unreachable.Add(dc.DcId);
            localUnreachable |= dc.IsLocal;
        }

        data["dc_count"] = _dcs.Count;
        data["unreachable_dc_count"] = unreachable.Count;

        if (unreachable.Count == 0)
        {
            return Task.FromResult(HealthCheckResult.Healthy(
                $"All {_dcs.Count} datacenter Redis link(s) are connected.", data));
        }

        var description =
            $"{unreachable.Count} of {_dcs.Count} datacenter Redis link(s) unreachable: " +
            string.Join(", ", unreachable) + ".";

        // Losing the LOCAL DC is categorically different from losing a peer: peer loss is degraded
        // cross-DC propagation, local loss means this control plane cannot write its own cache at
        // all and every commit it reports is a lie.
        return Task.FromResult(localUnreachable
            ? HealthCheckResult.Unhealthy(description + " The LOCAL datacenter is among them.", data: data)
            : HealthCheckResult.Degraded(description, data: data));
    }
}
