using System.Diagnostics;
using Api.RateLimiting;
using Domain.EndUsers;
using Domain.Observability;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Streaming.Connections;
using Streaming.Services;

namespace Api.Public;

[EnableRateLimiting(RateLimitingPolicies.Sdk)]
public class SdkController : PublicApiControllerBase
{
    private readonly IDataSyncService _dataSyncService;

    /// <summary>
    /// A request with no timestamp is a full bootstrap. Mirrors the constant the streaming path
    /// uses, so the two transports classify a sync identically.
    /// </summary>
    private const long FullSyncTimestamp = 0;

    /// <summary>
    /// Duration at or above which an HTTP sync span is always retained, matching the streaming
    /// path's threshold so the same slowness is judged the same way on either transport.
    /// </summary>
    private const double SlowSyncThresholdMs = 1_000d;

    public SdkController(IDataSyncService dataSyncService)
    {
        _dataSyncService = dataSyncService;
    }

    [HttpGet("server/latest-all")]
    public async Task<IActionResult> GetServerSideSdkPayloadAsync([FromQuery] long timestamp = 0)
    {
        var operation = OperationFor(timestamp);
        var start = Stopwatch.GetTimestamp();

        // T3 — the HTTP half. The streaming path records the same three instruments from
        // DataSyncService; polling SDKs and relay proxies never reach that code, so without this
        // they were absent from every sync signal.
        using var trace = TailSampledTrace.Start(
            TraceCategories.Sync, "sdk.sync", ActivityKind.Server, SlowSyncThresholdMs);

        trace.SetTag(ObservabilityTags.Operation, operation);
        trace.SetTag(ObservabilityTags.ConnectionType, ConnectionType.Server);

        try
        {
            var payload = await _dataSyncService.GetServerSdkPayloadAsync(EnvId, timestamp);

            var itemCount =
                payload.FeatureFlags.TryGetNonEnumeratedCount(out var flags) &&
                payload.Segments.TryGetNonEnumeratedCount(out var segments)
                    ? flags + segments
                    : (int?)null;

            SyncMetrics.Current.RecordPayload(
                operation,
                ConnectionType.Server,
                Outcomes.Success,
                Stopwatch.GetElapsedTime(start),
                itemCount);

            if (itemCount.HasValue)
            {
                trace.SetTag("sync.items", itemCount.Value);
            }

            trace.Success();

            if (payload.IsEmpty())
            {
                return Ok();
            }

            return new JsonResult(new { messageType = "data-sync", data = payload });
        }
        catch (Exception ex)
        {
            SyncMetrics.Current.RecordPayload(
                operation,
                ConnectionType.Server,
                Outcomes.Failure,
                Stopwatch.GetElapsedTime(start),
                itemCount: null);

            trace.Failed(ex);
            throw;
        }
    }

    [HttpPost("client/latest-all")]
    public async Task<IActionResult> GetClientSdkPayloadAsync(EndUser endUser, [FromQuery] long timestamp = 0)
    {
        var operation = OperationFor(timestamp);
        var start = Stopwatch.GetTimestamp();

        using var trace = TailSampledTrace.Start(
            TraceCategories.Sync, "sdk.sync", ActivityKind.Server, SlowSyncThresholdMs);

        trace.SetTag(ObservabilityTags.Operation, operation);
        trace.SetTag(ObservabilityTags.ConnectionType, ConnectionType.Client);

        // A malformed end user is rejected before any store read, so it is recorded as a rejected
        // sync rather than a failure — it is a client defect, and letting it inflate the server
        // failure rate would make this metric useless as an alert.
        if (!endUser.IsValid())
        {
            SyncMetrics.Current.RecordPayload(
                operation,
                ConnectionType.Client,
                Outcomes.Rejected,
                Stopwatch.GetElapsedTime(start),
                itemCount: null);

            trace.Ended(Outcomes.Rejected, "invalid_end_user");
            return BadRequest("invalid end user");
        }

        try
        {
            var payload = await _dataSyncService.GetClientSdkPayloadAsync(EnvId, endUser, timestamp);

            var itemCount = payload.FeatureFlags.TryGetNonEnumeratedCount(out var flags)
                ? flags
                : (int?)null;

            SyncMetrics.Current.RecordPayload(
                operation,
                ConnectionType.Client,
                Outcomes.Success,
                Stopwatch.GetElapsedTime(start),
                itemCount);

            if (itemCount.HasValue)
            {
                trace.SetTag("sync.items", itemCount.Value);
            }

            trace.Success();

            if (payload.IsEmpty())
            {
                return Ok();
            }

            return new JsonResult(new { messageType = "data-sync", data = payload });
        }
        catch (Exception ex)
        {
            SyncMetrics.Current.RecordPayload(
                operation,
                ConnectionType.Client,
                Outcomes.Failure,
                Stopwatch.GetElapsedTime(start),
                itemCount: null);

            trace.Failed(ex);
            throw;
        }
    }

    private static string OperationFor(long timestamp) =>
        timestamp == FullSyncTimestamp ? SyncMetrics.HttpFullOperation : SyncMetrics.HttpPatchOperation;
}
