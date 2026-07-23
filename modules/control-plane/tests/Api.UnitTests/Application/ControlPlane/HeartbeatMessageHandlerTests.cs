using System.Text.Json;
using Api.Application.ControlPlane;
using Application.Caches;
using Application.ControlPlane;
using Domain.ControlPlane;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Api.UnitTests.Application.ControlPlane;

public class HeartbeatMessageHandlerTests
{
    private readonly Mock<ICacheService> _cache = new();
    private readonly FakeLogger<HeartbeatMessageHandler> _logger = new();
    private readonly Mock<ILeaseStore> _leaseStore = new();

    private HeartbeatMessageHandler CreateSut(IConfiguration? configuration = null)
        => new(_cache.Object, _logger, _leaseStore.Object, configuration ?? BuildConfig());

    private static IConfiguration BuildConfig(
        string? consistencyMode = null, string? leaseTtlSeconds = null)
    {
        var values = new Dictionary<string, string?>();
        if (consistencyMode is not null)
        {
            values["ControlPlane:ConsistencyMode"] = consistencyMode;
        }
        if (leaseTtlSeconds is not null)
        {
            values["ControlPlane:LeaseTtlSeconds"] = leaseTtlSeconds;
        }

        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }

    [Fact]
    public async Task HandleAsync_WhenValid_CallsUpsertPodHeartbeat()
    {
        var sut = CreateSut();
        var msg = new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = DateTimeOffset.UtcNow
        };
        var payload = JsonSerializer.Serialize(msg);

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.UpsertPodHeartbeat(It.Is<HealthMessage>(m =>
            m.PodId == msg.PodId && m.Timestamp == msg.Timestamp)), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WhenMessageMissingPodId_DoesNotCallCache()
    {
        var sut = CreateSut();
        var payload = JsonSerializer.Serialize(new HealthMessage
        {
            PodId = "",
            Timestamp = DateTimeOffset.UtcNow
        });

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.UpsertPodHeartbeat(It.IsAny<HealthMessage>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenTimestampDefault_DoesNotCallCache()
    {
        var sut = CreateSut();
        var payload = JsonSerializer.Serialize(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = default
        });

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.UpsertPodHeartbeat(It.IsAny<HealthMessage>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenJsonInvalid_DoesNotThrowAndDoesNotCallCache()
    {
        var sut = CreateSut();

        await sut.HandleAsync("{not valid json");

        _cache.Verify(x => x.UpsertPodHeartbeat(It.IsAny<HealthMessage>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenJsonIsNullLiteral_DoesNotCallCache()
    {
        var sut = CreateSut();

        await sut.HandleAsync("null");

        _cache.Verify(x => x.UpsertPodHeartbeat(It.IsAny<HealthMessage>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenPayloadUsesCamelCase_CallsUpsertPodHeartbeat()
    {
        // Eval-server publishes camelCase JSON; the handler must accept it.
        var sut = CreateSut();
        var podId = Guid.NewGuid().ToString();
        var timestamp = DateTimeOffset.UtcNow;
        var payload =
            $"{{\"podId\":\"{podId}\",\"timestamp\":\"{timestamp:O}\"}}";

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.UpsertPodHeartbeat(It.Is<HealthMessage>(m =>
            m.PodId == podId && m.Timestamp == timestamp)), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WhenBestEffort_DoesNotUpsertLease()
    {
        // BestEffort is the default; no lease should be written.
        var sut = CreateSut();
        var payload = JsonSerializer.Serialize(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = DateTimeOffset.UtcNow
        });

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.UpsertPodHeartbeat(It.IsAny<HealthMessage>()), Times.Once);
        _leaseStore.Verify(x => x.UpsertLeaseAsync(It.IsAny<DcLease>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenBestEffortExplicit_DoesNotUpsertLease()
    {
        var sut = CreateSut(BuildConfig(consistencyMode: "BestEffort"));
        var payload = JsonSerializer.Serialize(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = DateTimeOffset.UtcNow
        });

        await sut.HandleAsync(payload);

        _leaseStore.Verify(x => x.UpsertLeaseAsync(It.IsAny<DcLease>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenGatedCommit_UpsertsLeaseWithDefaultTtl()
    {
        var sut = CreateSut(BuildConfig(consistencyMode: "GatedCommit"));
        var timestamp = DateTimeOffset.UtcNow;
        var watermarks = new Dictionary<Guid, long> { [Guid.NewGuid()] = 42 };
        var msg = new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = timestamp,
            Region = "west",
            DcId = "dc-1",
            AppliedWatermarks = watermarks
        };
        var payload = JsonSerializer.Serialize(msg);

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.UpsertPodHeartbeat(It.IsAny<HealthMessage>()), Times.Once);
        _leaseStore.Verify(x => x.UpsertLeaseAsync(It.Is<DcLease>(l =>
            l.DcId == "dc-1" &&
            l.Region == "west" &&
            l.LastHeartbeatAt == timestamp &&
            l.LeaseExpiresAt == timestamp.AddSeconds(15) &&
            l.AppliedWatermarks.Count == 1)), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WhenGatedCommitWithCustomTtl_UsesConfiguredTtl()
    {
        var sut = CreateSut(BuildConfig(consistencyMode: "GatedCommit", leaseTtlSeconds: "30"));
        var timestamp = DateTimeOffset.UtcNow;
        var msg = new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = timestamp,
            Region = "east",
            DcId = "dc-2"
        };
        var payload = JsonSerializer.Serialize(msg);

        await sut.HandleAsync(payload);

        _leaseStore.Verify(x => x.UpsertLeaseAsync(It.Is<DcLease>(l =>
            l.DcId == "dc-2" &&
            l.LeaseExpiresAt == timestamp.AddSeconds(30))), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WhenGatedCommitAndDcIdNull_FallsBackToPodId()
    {
        var sut = CreateSut(BuildConfig(consistencyMode: "GatedCommit"));
        var podId = Guid.NewGuid().ToString();
        var msg = new HealthMessage
        {
            PodId = podId,
            Timestamp = DateTimeOffset.UtcNow,
            Region = "west"
            // DcId omitted (null)
        };
        var payload = JsonSerializer.Serialize(msg);

        await sut.HandleAsync(payload);

        _leaseStore.Verify(x => x.UpsertLeaseAsync(It.Is<DcLease>(l =>
            l.DcId == podId)), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WhenGatedCommitAndWatermarksNull_UsesEmptyDictionary()
    {
        var sut = CreateSut(BuildConfig(consistencyMode: "GatedCommit"));
        var msg = new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = DateTimeOffset.UtcNow,
            DcId = "dc-3"
            // AppliedWatermarks omitted (null)
        };
        var payload = JsonSerializer.Serialize(msg);

        await sut.HandleAsync(payload);

        _leaseStore.Verify(x => x.UpsertLeaseAsync(It.Is<DcLease>(l =>
            l.AppliedWatermarks != null && l.AppliedWatermarks.Count == 0)), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WhenGatedCommitButInvalidMessage_DoesNotUpsertLease()
    {
        var sut = CreateSut(BuildConfig(consistencyMode: "GatedCommit"));
        var payload = JsonSerializer.Serialize(new HealthMessage
        {
            PodId = "",
            Timestamp = DateTimeOffset.UtcNow
        });

        await sut.HandleAsync(payload);

        _leaseStore.Verify(x => x.UpsertLeaseAsync(It.IsAny<DcLease>()), Times.Never);
    }

    // #99: HeartbeatMessageHandler is registered AddKeyedTransient (a new instance per message),
    // so cadence state is tracked process-wide (static). Each test below uses a unique DcId to
    // avoid bleeding state into other tests sharing that process-wide state.

    private void VerifyWarningLogged(Times times)
    {
        var count = _logger.Collector.GetSnapshot().Count(x => x.Level == LogLevel.Warning);
        if (times == Times.Never())
        {
            Assert.Equal(0, count);
        }
        else if (times == Times.Once())
        {
            Assert.Equal(1, count);
        }
    }

    [Fact]
    public async Task HandleAsync_WhenHeartbeatGapExceedsLeaseTtl_LogsWarningOnce()
    {
        var dcId = $"dc-cadence-slow-{Guid.NewGuid()}";
        var config = BuildConfig(consistencyMode: "GatedCommit", leaseTtlSeconds: "15");
        var t0 = DateTimeOffset.UtcNow;

        // Baseline heartbeat: no previous timestamp to compare against yet, so no warning.
        await CreateSut(config).HandleAsync(JsonSerializer.Serialize(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = t0,
            DcId = dcId
        }));
        VerifyWarningLogged(Times.Never());

        // Next heartbeat arrives 60s later — well beyond the 15s TTL, so the lease already
        // expired between the two heartbeats.
        await CreateSut(config).HandleAsync(JsonSerializer.Serialize(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = t0.AddSeconds(60),
            DcId = dcId
        }));
        VerifyWarningLogged(Times.Once());

        // A third slow heartbeat for the same DC does not warn again (rate-limited once per
        // DcId per process).
        await CreateSut(config).HandleAsync(JsonSerializer.Serialize(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = t0.AddSeconds(120),
            DcId = dcId
        }));
        VerifyWarningLogged(Times.Once());
    }

    [Fact]
    public async Task HandleAsync_WhenHeartbeatGapWithinLeaseTtl_DoesNotLogWarning()
    {
        var dcId = $"dc-cadence-ok-{Guid.NewGuid()}";
        var config = BuildConfig(consistencyMode: "GatedCommit", leaseTtlSeconds: "15");
        var t0 = DateTimeOffset.UtcNow;

        await CreateSut(config).HandleAsync(JsonSerializer.Serialize(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = t0,
            DcId = dcId
        }));

        // 5s later — coherent with a 15s TTL (<= TTL/3).
        await CreateSut(config).HandleAsync(JsonSerializer.Serialize(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = t0.AddSeconds(5),
            DcId = dcId
        }));

        VerifyWarningLogged(Times.Never());
    }

    [Fact]
    public async Task HandleAsync_WhenBestEffortAndCadenceSlow_DoesNotLogWarning()
    {
        // Cadence tracking only runs when a lease is being upserted (GatedCommit).
        var dcId = $"dc-cadence-besteffort-{Guid.NewGuid()}";
        var config = BuildConfig(consistencyMode: "BestEffort");
        var t0 = DateTimeOffset.UtcNow;

        await CreateSut(config).HandleAsync(JsonSerializer.Serialize(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = t0,
            DcId = dcId
        }));
        await CreateSut(config).HandleAsync(JsonSerializer.Serialize(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = t0.AddSeconds(60),
            DcId = dcId
        }));

        VerifyWarningLogged(Times.Never());
    }

    // #105: cadence tracking must be keyed by a GENUINE DcId only. When DcId is null, the lease
    // itself still falls back to PodId (HandleAsync_WhenGatedCommitAndDcIdNull_FallsBackToPodId
    // above already covers that), but the process-wide cadence dictionaries must NOT be keyed off
    // that PodId fallback — PodId is a fresh Guid every pod process, so tracking it would grow the
    // dictionaries unbounded-ish under a persistent DcId-less GatedCommit misconfiguration.

    [Fact]
    public async Task HandleAsync_WhenGatedCommitAndDcIdNull_DoesNotTrackCadence_EvenWithSamePodIdAndSlowGap()
    {
        var config = BuildConfig(consistencyMode: "GatedCommit", leaseTtlSeconds: "15");
        var t0 = DateTimeOffset.UtcNow;
        // Deliberately reuse the SAME PodId across both heartbeats: if cadence tracking incorrectly
        // fell back to keying on PodId (the pre-#105 lease-derived dcId), this 60s gap (>> the 15s
        // TTL) would trip the warning. It must not, because DcId is null on both messages.
        var podId = Guid.NewGuid().ToString();

        await CreateSut(config).HandleAsync(JsonSerializer.Serialize(new HealthMessage
        {
            PodId = podId,
            Timestamp = t0
            // DcId omitted (null)
        }));
        await CreateSut(config).HandleAsync(JsonSerializer.Serialize(new HealthMessage
        {
            PodId = podId,
            Timestamp = t0.AddSeconds(60)
            // DcId omitted (null)
        }));

        VerifyWarningLogged(Times.Never());
    }

    [Fact]
    public async Task HandleAsync_WhenGatedCommitAndDcIdEmptyString_StillTracksCadence_UnlikeNullDcId()
    {
        // An empty-string DcId is still non-null (heartBeatMessage.DcId ?? PodId does NOT fall back
        // for ""), so it is a genuine (if degenerate) DcId per the #105 "non-null" contract — cadence
        // tracking for it is expected to behave like any other DcId, i.e. it DOES warn on a slow gap.
        // This pins that boundary explicitly against regressing to "only non-empty DcId" instead.
        var config = BuildConfig(consistencyMode: "GatedCommit", leaseTtlSeconds: "15");
        var t0 = DateTimeOffset.UtcNow;

        await CreateSut(config).HandleAsync(JsonSerializer.Serialize(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = t0,
            DcId = ""
        }));
        await CreateSut(config).HandleAsync(JsonSerializer.Serialize(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = t0.AddSeconds(60),
            DcId = ""
        }));

        VerifyWarningLogged(Times.Once());
    }
}
