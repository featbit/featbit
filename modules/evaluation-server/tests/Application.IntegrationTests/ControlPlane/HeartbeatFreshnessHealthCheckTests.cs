using Api.Health;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging.Abstractions;

namespace Application.IntegrationTests.ControlPlane;

/// <summary>
/// Pure unit tests for <see cref="HeartbeatFreshnessHealthCheck"/> (no infra). The clock and the
/// publish-status singleton are injected so freshness can be exercised deterministically without
/// timers.
/// </summary>
[Trait("Category", "Host")]
public class HeartbeatFreshnessHealthCheckTests
{
    private static readonly DateTimeOffset T0 = new(2026, 6, 20, 12, 0, 0, TimeSpan.Zero);

    private sealed class FakeClock(DateTimeOffset start)
    {
        private DateTimeOffset _now = start;

        public DateTimeOffset Now() => _now;

        public void Advance(TimeSpan by) => _now += by;
    }

    private static IConfiguration Config(params (string Key, string? Value)[] values)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value)))
            .Build();

    private static HeartbeatFreshnessHealthCheck CreateSut(
        IConfiguration configuration,
        IHeartbeatPublishStatus status,
        FakeClock clock)
        => new(
            status,
            configuration,
            NullLogger<HeartbeatFreshnessHealthCheck>.Instance,
            clock.Now);

    private static Task<HealthCheckResult> Check(HeartbeatFreshnessHealthCheck sut)
        => sut.CheckHealthAsync(new HealthCheckContext());

    [Fact]
    public async Task BestEffort_IsAlwaysHealthy_RegardlessOfHeartbeatAge()
    {
        var config = Config(
            ("ControlPlane:ConsistencyMode", "BestEffort"),
            ("ControlPlane:HeartbeatStalenessThresholdSeconds", "10"));
        var status = new HeartbeatPublishStatus();
        status.MarkSuccess(T0); // very stale relative to the clock below
        var clock = new FakeClock(T0.AddHours(1));

        var result = await Check(CreateSut(config, status, clock));

        Assert.Equal(HealthStatus.Healthy, result.Status);
    }

    [Fact]
    public async Task GatedCommit_Fresh_IsHealthy()
    {
        var config = Config(
            ("ControlPlane:ConsistencyMode", "GatedCommit"),
            ("ControlPlane:HeartbeatStalenessThresholdSeconds", "60"));
        var clock = new FakeClock(T0);
        var status = new HeartbeatPublishStatus();
        status.MarkSuccess(T0);

        clock.Advance(TimeSpan.FromSeconds(10)); // within threshold

        var result = await Check(CreateSut(config, status, clock));

        Assert.Equal(HealthStatus.Healthy, result.Status);
    }

    [Fact]
    public async Task GatedCommit_Stale_IsUnhealthy_AndNamesDcIdAndAge()
    {
        var config = Config(
            ("ControlPlane:ConsistencyMode", "GatedCommit"),
            ("ControlPlane:DcId", "dc-west"),
            ("ControlPlane:HeartbeatStalenessThresholdSeconds", "60"));
        var clock = new FakeClock(T0);
        var status = new HeartbeatPublishStatus();
        status.MarkSuccess(T0);

        clock.Advance(TimeSpan.FromSeconds(120)); // past the 60s threshold

        var result = await Check(CreateSut(config, status, clock));

        Assert.Equal(HealthStatus.Unhealthy, result.Status);
        Assert.Contains("dc-west", result.Description);
        Assert.Contains("120", result.Description);
    }

    [Fact]
    public async Task GatedCommit_NeverPublished_WithinStartupGrace_IsHealthy()
    {
        var config = Config(
            ("ControlPlane:ConsistencyMode", "GatedCommit"),
            ("ControlPlane:HeartbeatStalenessThresholdSeconds", "60"));
        var clock = new FakeClock(T0); // startedAt captured at T0
        var status = new HeartbeatPublishStatus(); // never published

        var sut = CreateSut(config, status, clock);
        clock.Advance(TimeSpan.FromSeconds(30)); // still within startup grace (< 60s)

        var result = await Check(sut);

        Assert.Equal(HealthStatus.Healthy, result.Status);
    }

    [Fact]
    public async Task GatedCommit_NeverPublished_PastStartupGrace_IsUnhealthy()
    {
        var config = Config(
            ("ControlPlane:ConsistencyMode", "GatedCommit"),
            ("ControlPlane:DcId", "dc-east"),
            ("ControlPlane:HeartbeatStalenessThresholdSeconds", "60"));
        var clock = new FakeClock(T0);
        var status = new HeartbeatPublishStatus(); // never published

        var sut = CreateSut(config, status, clock);
        clock.Advance(TimeSpan.FromSeconds(120)); // past startup grace

        var result = await Check(sut);

        Assert.Equal(HealthStatus.Unhealthy, result.Status);
        Assert.Contains("dc-east", result.Description);
    }

    [Fact]
    public async Task GatedCommit_UsesDefaultThreshold_WhenUnset()
    {
        var config = Config(
            ("ControlPlane:ConsistencyMode", "GatedCommit"));
        var clock = new FakeClock(T0);
        var status = new HeartbeatPublishStatus();
        status.MarkSuccess(T0);

        // Just under the documented default (15s) -> still healthy.
        clock.Advance(TimeSpan.FromSeconds(HeartbeatFreshnessHealthCheck.DefaultStalenessThresholdSeconds - 1));
        Assert.Equal(HealthStatus.Healthy, (await Check(CreateSut(config, status, clock))).Status);

        // Past the default -> unhealthy (hard readiness fence).
        clock.Advance(TimeSpan.FromSeconds(2));
        Assert.Equal(HealthStatus.Unhealthy, (await Check(CreateSut(config, status, clock))).Status);
    }

    [Fact]
    public void MarkFailure_DoesNotAdvanceLastSuccess()
    {
        var status = new HeartbeatPublishStatus();
        status.MarkSuccess(T0);

        status.MarkFailure(T0.AddSeconds(30));

        Assert.Equal(T0, status.LastSuccessfulPublishAt);
    }

    [Fact]
    public void LastSuccessfulPublishAt_IsNull_BeforeFirstSuccess()
    {
        var status = new HeartbeatPublishStatus();

        Assert.Null(status.LastSuccessfulPublishAt);
    }

    /// <summary>
    /// Readiness contract (HARD FENCE): ASP.NET Core's default mapping returns HTTP 503 for
    /// <see cref="HealthStatus.Unhealthy"/> (only Healthy/Degraded → 200). The check is tagged for
    /// <c>/health/readiness</c>, so under GatedCommit a stale heartbeat FAILS readiness and the pod is
    /// pulled from rotation. Under BestEffort the check is a no-op (never Unhealthy), so it can never
    /// fence a pod when gating is off.
    /// </summary>
    [Fact]
    public async Task BestEffort_NeverUnhealthy_EvenWhenVeryStale()
    {
        var bestEffort = Config(("ControlPlane:ConsistencyMode", "BestEffort"));
        var s1 = new HeartbeatPublishStatus();
        s1.MarkSuccess(T0);
        // Even an hour stale, BestEffort must stay Healthy (never fences readiness).
        var result = await Check(CreateSut(bestEffort, s1, new FakeClock(T0.AddHours(1))));
        Assert.Equal(HealthStatus.Healthy, result.Status);
    }

    [Fact]
    public async Task GatedCommit_FarPastThreshold_IsUnhealthy_FailingReadiness()
    {
        var gated = Config(
            ("ControlPlane:ConsistencyMode", "GatedCommit"),
            ("ControlPlane:HeartbeatStalenessThresholdSeconds", "30"));
        var clock = new FakeClock(T0);
        var sut = CreateSut(gated, new HeartbeatPublishStatus(), clock); // never published
        clock.Advance(TimeSpan.FromHours(1));
        var result = await Check(sut);
        Assert.Equal(HealthStatus.Unhealthy, result.Status);
    }

    /// <summary>
    /// #104 coherence guard: the readiness-fence default must stay a few multiples of the
    /// heartbeat-interval default, not drift independently (as happened when #99 changed the
    /// interval default from 60s to 5s but this threshold's 180s default, derived against the old
    /// interval, was left behind — 36 missed heartbeats instead of the intended ~3). Pin the
    /// relationship directly against <see cref="HeartbeatService.DefaultHeartbeatIntervalSeconds"/>
    /// so a future change to either default that breaks the coherence fails this test.
    /// </summary>
    [Fact]
    public void DefaultStalenessThreshold_IsCoherentWithDefaultHeartbeatInterval()
    {
        var thresholdDefault = HeartbeatFreshnessHealthCheck.DefaultStalenessThresholdSeconds;
        var intervalDefault = HeartbeatService.DefaultHeartbeatIntervalSeconds;

        Assert.True(
            thresholdDefault >= 3 * intervalDefault,
            $"DefaultStalenessThresholdSeconds ({thresholdDefault}) should be at least 3x " +
            $"DefaultHeartbeatIntervalSeconds ({intervalDefault}) so a pod tolerates a few missed " +
            "heartbeats before its readiness fence trips.");
    }
}
