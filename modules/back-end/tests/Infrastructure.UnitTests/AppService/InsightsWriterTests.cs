using Application.Services;
using Infrastructure.AppService;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Infrastructure.UnitTests.AppService;

public class InsightsWriterTests
{
    [Fact]
    public async Task ContinuesWithNextBatchAfterPersistenceFailure()
    {
        var first = new object();
        var second = new object();
        var persisted = new TaskCompletionSource<object[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var attempts = 0;
        var service = new Mock<IInsightService>();
        service
            .Setup(x => x.AddManyAsync(It.IsAny<object[]>()))
            .Returns<object[]>(batch =>
            {
                if (Interlocked.Increment(ref attempts) == 1)
                {
                    throw new InvalidOperationException("Persistence failure");
                }

                persisted.TrySetResult(batch);
                return Task.CompletedTask;
            });

        await using var provider = CreateServiceProvider(service.Object);
        var writer = new InsightsWriter(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<InsightsWriter>.Instance,
            TimeSpan.FromHours(1),
            channelCapacity: 10,
            maxBatchSize: 1
        );

        await writer.RecordAsync(first);
        await writer.RecordAsync(second);
        await writer.StartAsync(CancellationToken.None);

        var batch = await persisted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await writer.StopAsync(CancellationToken.None);

        Assert.Equal(2, attempts);
        Assert.Equal([second], batch);
    }

    [Fact]
    public async Task FlushesPartialBatchAfterTimeout()
    {
        var insight = new object();
        var persisted = new TaskCompletionSource<object[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var service = new Mock<IInsightService>();
        service
            .Setup(x => x.AddManyAsync(It.IsAny<object[]>()))
            .Returns<object[]>(batch =>
            {
                persisted.TrySetResult(batch);
                return Task.CompletedTask;
            });

        await using var provider = CreateServiceProvider(service.Object);
        var writer = CreateWriter(provider.GetRequiredService<IServiceScopeFactory>());

        await writer.StartAsync(CancellationToken.None);
        await writer.RecordAsync(insight);

        var batch = await persisted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await writer.StopAsync(CancellationToken.None);

        Assert.Equal([insight], batch);
    }

    [Fact]
    public async Task FlushesImmediatelyWhenBatchIsFull()
    {
        var insights = new[] { new object(), new object(), new object() };
        var persisted = new TaskCompletionSource<object[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var service = new Mock<IInsightService>();
        service
            .Setup(x => x.AddManyAsync(It.IsAny<object[]>()))
            .Returns<object[]>(batch =>
            {
                persisted.TrySetResult(batch);
                return Task.CompletedTask;
            });

        await using var provider = CreateServiceProvider(service.Object);
        var writer = new InsightsWriter(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<InsightsWriter>.Instance,
            TimeSpan.FromHours(1),
            channelCapacity: 10,
            maxBatchSize: insights.Length
        );

        foreach (var insight in insights)
        {
            await writer.RecordAsync(insight);
        }

        await writer.StartAsync(CancellationToken.None);

        var batch = await persisted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await writer.StopAsync(CancellationToken.None);

        Assert.Equal(insights, batch);
    }

    [Fact]
    public async Task StopAsyncFlushesPartialBatchBeforeTimeout()
    {
        var insight = new object();
        var persisted = new TaskCompletionSource<object[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var service = new Mock<IInsightService>();
        service
            .Setup(x => x.AddManyAsync(It.IsAny<object[]>()))
            .Returns<object[]>(batch =>
            {
                persisted.TrySetResult(batch);
                return Task.CompletedTask;
            });

        await using var provider = CreateServiceProvider(service.Object);
        var writer = new InsightsWriter(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<InsightsWriter>.Instance,
            TimeSpan.FromHours(1),
            channelCapacity: 10,
            maxBatchSize: 10
        );

        await writer.StartAsync(CancellationToken.None);
        await writer.RecordAsync(insight);
        await writer.StopAsync(CancellationToken.None);

        var batch = await persisted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal([insight], batch);
    }

    private static ServiceProvider CreateServiceProvider(IInsightService insightService)
    {
        return new ServiceCollection()
            .AddSingleton(insightService)
            .BuildServiceProvider();
    }

    private static InsightsWriter CreateWriter(IServiceScopeFactory scopeFactory)
    {
        return new InsightsWriter(
            scopeFactory,
            NullLogger<InsightsWriter>.Instance,
            TimeSpan.FromMilliseconds(10),
            channelCapacity: 10,
            maxBatchSize: 10
        );
    }
}
