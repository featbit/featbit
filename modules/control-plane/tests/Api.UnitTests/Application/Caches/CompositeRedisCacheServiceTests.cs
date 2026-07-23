using Api.Infrastructure.Caches;
using Application.Caches;
using Domain.ControlPlane;
using Domain.Environments;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Api.UnitTests.Application.Caches;

public class CompositeRedisCacheServiceTests
{
    private const string LocalDcId = "dc-local";
    private const string RemoteDcId = "dc-remote";

    private readonly Mock<ICacheService> _local = new();
    private readonly Mock<ICacheService> _remote = new();
    private readonly FakeLogger<CompositeRedisCacheService> _logger = new();

    private CompositeRedisCacheService CreateSut()
        => new(
            new[]
            {
                new DcCacheService(LocalDcId, _local.Object),
                new DcCacheService(RemoteDcId, _remote.Object)
            },
            _logger);

    [Fact]
    public async Task UpsertPodHeartbeat_WritesToLocalInstanceOnly()
    {
        var sut = CreateSut();
        var msg = new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = DateTimeOffset.UtcNow
        };

        await sut.UpsertPodHeartbeat(msg);

        _local.Verify(s => s.UpsertPodHeartbeat(msg), Times.Once);
        _remote.Verify(s => s.UpsertPodHeartbeat(It.IsAny<HealthMessage>()), Times.Never);
    }

    [Fact]
    public async Task UpsertPodHeartbeat_WhenLocalThrows_DoesNotBubbleAndDoesNotHitRemote()
    {
        _local.Setup(s => s.UpsertPodHeartbeat(It.IsAny<HealthMessage>()))
              .ThrowsAsync(new InvalidOperationException("boom"));

        var sut = CreateSut();

        await sut.UpsertPodHeartbeat(new HealthMessage
        {
            PodId = Guid.NewGuid().ToString(),
            Timestamp = DateTimeOffset.UtcNow
        });

        _remote.Verify(s => s.UpsertPodHeartbeat(It.IsAny<HealthMessage>()), Times.Never);
    }

    [Fact]
    public async Task GetAllHealthMessages_ReadsFromLocalInstanceOnly()
    {
        var expected = new List<HealthMessage>
        {
            new() { PodId = Guid.NewGuid().ToString(), Timestamp = DateTimeOffset.UtcNow }
        };
        _local.Setup(s => s.GetAllHealthMessages()).ReturnsAsync(expected);

        var sut = CreateSut();

        var actual = await sut.GetAllHealthMessages();

        Assert.Same(expected, actual);
        _remote.Verify(s => s.GetAllHealthMessages(), Times.Never);
    }

    [Fact]
    public async Task DeletePodConnection_BroadcastsToAllInstances()
    {
        var podId = Guid.NewGuid();
        var sut = CreateSut();

        await sut.DeletePodConnection(podId);

        _local.Verify(s => s.DeletePodConnection(podId), Times.Once);
        _remote.Verify(s => s.DeletePodConnection(podId), Times.Once);
    }

    [Fact]
    public async Task BroadcastAsync_WhenAllInstancesSucceed_ReturnsTrueForEachDcId()
    {
        var sut = CreateSut();

        var result = await sut.BroadcastAsync(_ => Task.CompletedTask, "Op");

        Assert.Equal(2, result.Count);
        Assert.True(result[LocalDcId]);
        Assert.True(result[RemoteDcId]);
    }

    [Fact]
    public async Task BroadcastAsync_WhenOneInstanceThrows_ReturnsFalseForThatDcIdAndTrueForOthers()
    {
        // The remote DC is configured to fail for this operation.
        var failing = new Mock<ICacheService>();
        failing.Setup(s => s.DeletePodConnection(It.IsAny<Guid>()))
               .ThrowsAsync(new InvalidOperationException("boom"));

        var sut = new CompositeRedisCacheService(
            new[]
            {
                new DcCacheService(LocalDcId, _local.Object),
                new DcCacheService(RemoteDcId, failing.Object)
            },
            _logger);

        // Should not throw out of the broadcast.
        var result = await sut.BroadcastAsync(
            s => s.DeletePodConnection(Guid.NewGuid()), nameof(ICacheService.DeletePodConnection));

        Assert.Equal(2, result.Count);
        Assert.True(result[LocalDcId]);
        Assert.False(result[RemoteDcId]);
    }

    // ----- #91: UpsertSecretToDcAsync targeted routing -----

    private static (ResourceDescriptor Descriptor, Secret Secret) CreateSecret()
    {
        var envId = Guid.NewGuid();
        var descriptor = new ResourceDescriptor
        {
            Organization = new IdNameKeyProps { Id = Guid.NewGuid(), Name = "org", Key = "org-key" },
            Project = new IdNameKeyProps { Id = Guid.NewGuid(), Name = "proj", Key = "proj-key" },
            Environment = new IdNameKeyProps { Id = envId, Name = "env", Key = "env-key" }
        };
        var secret = new Secret(envId, "Server Key", SecretTypes.Server);

        return (descriptor, secret);
    }

    [Fact]
    public async Task UpsertSecretToDcAsync_RoutesToTargetDcOnly()
    {
        var (descriptor, secret) = CreateSecret();
        var sut = CreateSut();

        await sut.UpsertSecretToDcAsync(RemoteDcId, descriptor, secret);

        _remote.Verify(s => s.UpsertSecretAsync(descriptor, secret), Times.Once);
        _local.Verify(s => s.UpsertSecretAsync(It.IsAny<ResourceDescriptor>(), It.IsAny<Secret>()), Times.Never);
    }

    [Fact]
    public async Task UpsertSecretToDcAsync_UnknownDc_IsNoOp()
    {
        var (descriptor, secret) = CreateSecret();
        var sut = CreateSut();

        await sut.UpsertSecretToDcAsync("dc-does-not-exist", descriptor, secret);

        _local.Verify(s => s.UpsertSecretAsync(It.IsAny<ResourceDescriptor>(), It.IsAny<Secret>()), Times.Never);
        _remote.Verify(s => s.UpsertSecretAsync(It.IsAny<ResourceDescriptor>(), It.IsAny<Secret>()), Times.Never);
    }
}
