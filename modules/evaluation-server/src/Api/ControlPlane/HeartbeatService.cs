using Domain.ControlPlane;
using Domain.Messages;
using Domain.Observability;
using Streaming.ControlPlane;

namespace Api.ControlPlane;

public partial class HeartbeatService(
    IMessageProducer messageProducer,
    ILogger<HeartbeatService> logger,
    IConfiguration configuration,
    IAppliedWatermarkReader appliedWatermarkReader,
    IHeartbeatPublishStatus publishStatus) : BackgroundService
{
    private readonly Guid _podId = InfrastructureInfo.Id;

    private readonly WorkerObservability _observability = ServiceMeter.ForWorker(WorkerNames.Heartbeat);

    /// <summary>
    /// Fallback heartbeat interval used when ControlPlane:HeartbeatIntervalSeconds is unset or
    /// non-positive (e.g. a deployment that drops the ControlPlane config section entirely gets
    /// GetValue&lt;int&gt; == 0). Kept coherent with the control plane's default
    /// ControlPlane:LeaseTtlSeconds (15s): the heartbeat interval should stay &lt;= LeaseTtlSeconds/3
    /// so a couple of missed heartbeats don't expire the lease. #99: previously 60s, incoherent
    /// with the 15s TTL, made DC leases flap and stalled GatedCommit.
    /// </summary>
    internal const int DefaultHeartbeatIntervalSeconds = 5;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Log.Started(logger, _podId);

        var heartbeatTimeSpan = TimeSpan.FromSeconds(ResolveHeartbeatIntervalSeconds(configuration));

        _observability.Started();

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                _observability.Heartbeat();

                try
                {
                    await messageProducer.PublishAsync(Topics.PodHeartbeat, await BuildHeartbeatAsync(stoppingToken));

                    // D5 (#22): record a successful publish so HeartbeatFreshnessHealthCheck can detect
                    // when this pod can no longer reach the control plane.
                    publishStatus.MarkSuccess(DateTimeOffset.UtcNow);
                    _observability.Success();
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    // Shutdown — stop the loop without recording a failure.
                    break;
                }
                catch (Exception ex)
                {
                    // Leave LastSuccessfulPublishAt unchanged: the freshness check measures age since the
                    // last successful publish, which is exactly what should grow while publishing fails.
                    publishStatus.MarkFailure(DateTimeOffset.UtcNow);
                    _observability.LoopFailed(ex);
                    Log.PublishFailed(logger, _podId, ex);
                }

                await Task.Delay(heartbeatTimeSpan, stoppingToken);
            }
        }
        finally
        {
            _observability.Stopped();
        }

        Log.Stopping(logger, _podId);
    }

    /// <summary>
    /// Builds the heartbeat payload for the current pod: liveness (PodId/Timestamp),
    /// placement (DcId/Region from config), and how far this DC is serving per environment
    /// (AppliedWatermarks). The watermarks are derived from the local DC Redis flag index via
    /// <see cref="IAppliedWatermarkReader"/>, so all pods in a DC report the same value and a
    /// fresh pod is immediately correct. Extracted for testing.
    /// </summary>
    internal async Task<HealthMessage> BuildHeartbeatAsync(CancellationToken cancellationToken = default)
    {
        var watermarks = await appliedWatermarkReader.ReadAsync(cancellationToken);

        return new HealthMessage
        {
            PodId = _podId.ToString(),
            Timestamp = DateTimeOffset.UtcNow,
            Region = configuration.GetRegion(),
            DcId = configuration.GetDcId(),
            AppliedWatermarks = watermarks.Count > 0 ? watermarks : null
        };
    }

    /// <summary>
    /// Resolves the configured heartbeat interval, falling back to
    /// <see cref="DefaultHeartbeatIntervalSeconds"/> when unset or non-positive. Extracted for
    /// testing.
    /// </summary>
    internal static int ResolveHeartbeatIntervalSeconds(IConfiguration configuration)
    {
        var configured = configuration.GetHeartbeatIntervalSeconds();
        return configured > 0 ? configured : DefaultHeartbeatIntervalSeconds;
    }
}
