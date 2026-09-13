using System.Diagnostics;
using System.Text.Json;
using Domain.Messages;
using Domain.Observability;
using Domain.Shared;
using Infrastructure.Caches.Redis;
using Infrastructure.MQ.Redis;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackExchange.Redis;

namespace Infrastructure.UnitTests.MQ.Redis;

[Collection(TraceContextCollection.Name)]
public class RedisMessageProducerTests
{
    private const string TestSource = "FeatBit.Tests.RedisMessageProducer";

    private sealed record FlagChange(string Id, string EnvId);

    [Fact]
    public async Task PublishAsync_WithAmbientActivity_WritesTraceContextIntoJsonPayload()
    {
        using var cleanup = ListeningSource(out var source);
        using var activity = source.StartActivity("publish");
        Assert.NotNull(activity);
        var current = Activity.Current ?? throw new InvalidOperationException("Expected the test activity to be current.");
        var message = new FlagChange("flag-1", "env-1");

        var produced = await PublishAsync(message);

        using var document = JsonDocument.Parse(produced);
        Assert.Equal(
            current.Id,
            document.RootElement.GetProperty(JsonTraceContext.TraceParentProperty).GetString());

        var context = JsonTraceContext.Extract(produced);
        Assert.Equal(current.TraceId, context.TraceId);
    }

    [Fact]
    public async Task PublishAsync_WithNoAmbientActivity_WritesPlainSerializedPayload()
    {
        var message = new FlagChange("flag-1", "env-1");
        var serialized = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);

        var produced = await PublishAsync(message);

        Assert.Equal(serialized, produced);
    }

    private static async Task<string> PublishAsync<TMessage>(TMessage message) where TMessage : class
    {
        var redisClient = new Mock<IRedisClient>();
        var database = new Mock<IDatabase>();
        var pushedValue = RedisValue.Null;

        redisClient.Setup(x => x.GetDatabase()).Returns(database.Object);
        database
            .Setup(x => x.ListRightPushAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<When>(),
                It.IsAny<CommandFlags>()))
            .Returns((RedisKey key, RedisValue value, When when, CommandFlags flags) =>
            {
                pushedValue = value;
                return Task.FromResult(1L);
            });

        var sut = new RedisMessageProducer(redisClient.Object, NullLogger<RedisMessageProducer>.Instance);

        await sut.PublishAsync(Topics.FeatureFlagChange, message);

        return pushedValue.ToString();
    }

    private static IDisposable ListeningSource(out ActivitySource source)
    {
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();

        var created = new ActivitySource(TestSource);
        source = created;

        return new Cleanup(created);
    }

    private sealed class Cleanup(ActivitySource source) : IDisposable
    {
        public void Dispose()
        {
            source.Dispose();
            ActivityCorrelation.RemoveListener();
        }
    }
}
