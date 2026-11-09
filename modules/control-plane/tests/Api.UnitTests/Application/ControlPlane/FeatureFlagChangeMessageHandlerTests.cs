using System.Text.Json;
using Api.Application.ControlPlane;
using Application.Caches;
using Application.FeatureFlags;
using Application.Services;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Messages;
using Domain.Utils;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Api.UnitTests.Application.ControlPlane;

public class FeatureFlagChangeMessageHandlerTests
{
    private const string Region = "us-east-1";

    private readonly Mock<ICacheService> _cache = new();
    private readonly Mock<IMessageProducer> _producer = new();
    private readonly Mock<IFeatureFlagService> _flagService = new();
    private readonly FakeLogger<FeatureFlagChangeMessageHandler> _logger = new();

    private static IConfiguration BuildConfiguration(string? consistencyMode)
    {
        var values = new Dictionary<string, string?>
        {
            ["Region"] = Region
        };

        if (consistencyMode != null)
        {
            values["ControlPlane:ConsistencyMode"] = consistencyMode;
        }

        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }

    private FeatureFlagChangeMessageHandler CreateSut(string? consistencyMode = null)
        => new(
            _cache.Object,
            _producer.Object,
            _flagService.Object,
            _logger,
            BuildConfiguration(consistencyMode));

    private static string BuildMessage(out FeatureFlag flag)
    {
        flag = new FeatureFlag
        {
            EnvId = Guid.NewGuid(),
            Key = "my-flag",
            UpdatedAt = new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc)
        };

        var onFeatureFlagChanged =
            new OnFeatureFlagChanged(flag, Guid.NewGuid(), Guid.NewGuid(), "op", new DataChange(), Guid.NewGuid(), "user");

        var message = new
        {
            notification = onFeatureFlagChanged,
            region = Region
        };

        return JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);
    }

    [Fact]
    public async Task HandleAsync_BestEffort_UpsertsAndPublishes()
    {
        var sut = CreateSut(consistencyMode: "BestEffort");
        var message = BuildMessage(out _);

        await sut.HandleAsync(message);

        _cache.Verify(x => x.UpsertFlagAsync(It.IsAny<FeatureFlag>()), Times.Once);
        _producer.Verify(
            x => x.PublishAsync(Topics.FeatureFlagChange, It.IsAny<FeatureFlag>()), Times.Once);

        _cache.Verify(x => x.StageFlagAsync(It.IsAny<FeatureFlag>(), It.IsAny<long>()), Times.Never);
        _flagService.Verify(
            x => x.SetPendingAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<FeatureFlag>(), It.IsAny<long>()),
            Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenModeUnset_DefaultsToBestEffort()
    {
        var sut = CreateSut(consistencyMode: null);
        var message = BuildMessage(out _);

        await sut.HandleAsync(message);

        _cache.Verify(x => x.UpsertFlagAsync(It.IsAny<FeatureFlag>()), Times.Once);
        _producer.Verify(
            x => x.PublishAsync(Topics.FeatureFlagChange, It.IsAny<FeatureFlag>()), Times.Once);
        _cache.Verify(x => x.StageFlagAsync(It.IsAny<FeatureFlag>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_GatedCommit_StagesAndSetsPending_DoesNotPublishFlagChange()
    {
        var sut = CreateSut(consistencyMode: "GatedCommit");
        var message = BuildMessage(out var flag);
        var expectedTs = new DateTimeOffset(flag.UpdatedAt).ToUnixTimeMilliseconds();

        await sut.HandleAsync(message);

        _cache.Verify(
            x => x.StageFlagAsync(It.Is<FeatureFlag>(f => f.Key == flag.Key), expectedTs),
            Times.Once);
        _flagService.Verify(
            x => x.SetPendingAsync(
                flag.EnvId, flag.Key, It.Is<FeatureFlag>(f => f.Key == flag.Key), expectedTs),
            Times.Once);

        _cache.Verify(x => x.UpsertFlagAsync(It.IsAny<FeatureFlag>()), Times.Never);
        _producer.Verify(
            x => x.PublishAsync(Topics.FeatureFlagChange, It.IsAny<FeatureFlag>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenJsonInvalid_Rethrows()
    {
        var sut = CreateSut();

        await Assert.ThrowsAnyAsync<Exception>(() => sut.HandleAsync("{not valid json"));
    }

    private static string BuildDeleteMessage(Guid envId, Guid flagId, string? region = Region)
        => JsonSerializer.Serialize(
            new { deleted = new { envId, id = flagId }, region },
            ReusableJsonSerializerOptions.Web);

    [Fact]
    public async Task HandleAsync_Deleted_DeletesTheFlagFromEveryDcAndPublishesNothing()
    {
        var sut = CreateSut();
        var envId = Guid.NewGuid();
        var flagId = Guid.NewGuid();

        await sut.HandleAsync(BuildDeleteMessage(envId, flagId));

        _cache.Verify(x => x.DeleteFlagAsync(envId, flagId), Times.Once);
        _cache.Verify(x => x.UpsertFlagAsync(It.IsAny<FeatureFlag>()), Times.Never);
        _producer.Verify(
            x => x.PublishAsync(It.IsAny<string>(), It.IsAny<It.IsAnyType>()), Times.Never);
    }

    [Theory]
    [InlineData("another-region")]
    [InlineData(null)]
    public async Task HandleAsync_Deleted_ForAnotherRegion_DoesNothing(string? region)
    {
        var sut = CreateSut();

        await sut.HandleAsync(BuildDeleteMessage(Guid.NewGuid(), Guid.NewGuid(), region));

        _cache.Verify(x => x.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    [Theory]
    [InlineData("""{"deleted":{"id":"3f2c3f64-6d6a-4f4b-9f0a-1d7c2f8c9a01"},"region":"us-east-1"}""")]
    [InlineData("""{"deleted":{"envId":"3f2c3f64-6d6a-4f4b-9f0a-1d7c2f8c9a01"},"region":"us-east-1"}""")]
    [InlineData("""{"deleted":{"envId":"3f2c3f64-6d6a-4f4b-9f0a-1d7c2f8c9a01","id":"5b8d7a10-1c2e-4d3f-8a9b-0c1d2e3f4a5b"}}""")]
    public async Task HandleAsync_DeletedWithMissingFields_Throws(string payload)
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<InvalidDataException>(() => sut.HandleAsync(payload));

        _cache.Verify(x => x.DeleteFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }
}
