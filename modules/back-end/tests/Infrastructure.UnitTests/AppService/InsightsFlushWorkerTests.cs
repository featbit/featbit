using Application.Insights;
using Application.Services;
using Infrastructure.AppService;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;

namespace Infrastructure.UnitTests.AppService;

public class InsightsFlushWorkerTests
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
        var options = CreateOptions(flushIntervalMs: 30_000, maxBatchSize: 1);

        await using var provider = CreateServiceProvider(service.Object);
        var tracker = new InsightsTracker(options);
        var worker = CreateWorker(tracker, provider, options);

        await tracker.RecordAsync(first);
        await tracker.RecordAsync(second);
        await worker.StartAsync(CancellationToken.None);

        var batch = await persisted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await worker.StopAsync(CancellationToken.None);

        Assert.Equal(2, attempts);
        Assert.Equal([second], batch);
    }

    [Fact]
    public async Task FlushesPartialBatchAfterTimeout()
    {
        var insight = new object();
        var persisted = new TaskCompletionSource<object[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var service = CreateInsightService(persisted);
        var options = CreateOptions(flushIntervalMs: 10);

        await using var provider = CreateServiceProvider(service.Object);
        var tracker = new InsightsTracker(options);
        var worker = CreateWorker(tracker, provider, options);

        await worker.StartAsync(CancellationToken.None);
        await tracker.RecordAsync(insight);

        var batch = await persisted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await worker.StopAsync(CancellationToken.None);

        Assert.Equal([insight], batch);
    }

    [Fact]
    public async Task FlushesImmediatelyWhenBatchIsFull()
    {
        var insights = new[] { new object(), new object(), new object() };
        var persisted = new TaskCompletionSource<object[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var service = CreateInsightService(persisted);
        var options = CreateOptions(flushIntervalMs: 30_000, maxBatchSize: insights.Length);

        await using var provider = CreateServiceProvider(service.Object);
        var tracker = new InsightsTracker(options);
        var worker = CreateWorker(tracker, provider, options);

        foreach (var insight in insights)
        {
            await tracker.RecordAsync(insight);
        }

        await worker.StartAsync(CancellationToken.None);

        var batch = await persisted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await worker.StopAsync(CancellationToken.None);

        Assert.Equal(insights, batch);
    }

    [Fact]
    public async Task StopAsyncFlushesPartialBatchBeforeTimeout()
    {
        var insight = new object();
        var persisted = new TaskCompletionSource<object[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var service = CreateInsightService(persisted);
        var options = CreateOptions(flushIntervalMs: 30_000);

        await using var provider = CreateServiceProvider(service.Object);
        var tracker = new InsightsTracker(options);
        var worker = CreateWorker(tracker, provider, options);

        await worker.StartAsync(CancellationToken.None);
        await tracker.RecordAsync(insight);
        await worker.StopAsync(CancellationToken.None);

        var batch = await persisted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal([insight], batch);
    }

    private static Mock<IInsightService> CreateInsightService(TaskCompletionSource<object[]> persisted)
    {
        var service = new Mock<IInsightService>();
        service
            .Setup(x => x.AddManyAsync(It.IsAny<object[]>()))
            .Returns<object[]>(batch =>
            {
                persisted.TrySetResult(batch);
                return Task.CompletedTask;
            });
        return service;
    }

    private static IOptions<InsightsTrackingOptions> CreateOptions(
        int flushIntervalMs,
        int maxBatchSize = 10)
    {
        return Options.Create(new InsightsTrackingOptions
        {
            FlushIntervalMs = flushIntervalMs,
            ChannelCapacity = 10,
            MaxBatchSize = maxBatchSize
        });
    }

    private static ServiceProvider CreateServiceProvider(IInsightService insightService)
    {
        return new ServiceCollection()
            .AddSingleton(insightService)
            .BuildServiceProvider();
    }

    private static InsightsFlushWorker CreateWorker(
        InsightsTracker tracker,
        IServiceProvider serviceProvider,
        IOptions<InsightsTrackingOptions> options)
    {
        return new InsightsFlushWorker(
            tracker,
            serviceProvider.GetRequiredService<IServiceScopeFactory>(),
            options,
            NullLogger<InsightsFlushWorker>.Instance
        );
    }
}
