using Api.Application.ControlPlane;
using Application.Caches;
using Domain.Health;
using Microsoft.Extensions.Logging.Testing;
using Microsoft.Extensions.Options;
using Moq;

namespace Api.UnitTests.Application.ControlPlane;

public class PodHealthCheckerTests
{
    private readonly Mock<ICacheService> _cache = new();
    private readonly FakeLogger<PodHealthChecker> _logger = new();

    private static IOptionsMonitor<PodHealthOptions> BuildOptions(
        int timeoutSeconds,
        int checkIntervalSeconds,
        bool enabled = true)
    {
        var value = new PodHealthOptions
        {
            Enabled = enabled,
            TimeoutInSeconds = timeoutSeconds,
            CheckIntervalInSeconds = checkIntervalSeconds
        };

        var monitor = new Mock<IOptionsMonitor<PodHealthOptions>>();
        monitor.SetupGet(m => m.CurrentValue).Returns(value);
        return monitor.Object;
    }

    private async Task RunOnceAsync(PodHealthChecker sut, Task? iterationCompleted = null)
    {
        using var cts = new CancellationTokenSource();
        var task = sut.StartAsync(cts.Token);
        if (iterationCompleted is not null)
        {
            await iterationCompleted.WaitAsync(TimeSpan.FromSeconds(3));
        }
        else
        {
            await Task.Yield();
        }

        await cts.CancelAsync();
        await sut.StopAsync(CancellationToken.None);
        await task;
    }

    [Fact]
    public async Task ExecuteAsync_WhenPodHeartbeatPastTimeout_DeletesPodConnection()
    {
        var deadPodId = Guid.NewGuid();
        var iterationCompleted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _cache.Setup(c => c.GetAllHealthMessages())
            .Callback(() => iterationCompleted.TrySetResult())
            .ReturnsAsync(new List<HealthMessage>
            {
                new() { PodId = deadPodId.ToString(), Timestamp = DateTimeOffset.UtcNow.AddSeconds(-300) }
            });

        var sut = new PodHealthChecker(_cache.Object, _logger, BuildOptions(60, 60));

        await RunOnceAsync(sut, iterationCompleted.Task);

        _cache.Verify(c => c.DeletePodConnection(deadPodId), Times.AtLeastOnce);
    }

    [Fact]
    public async Task ExecuteAsync_WhenPodHeartbeatWithinTimeout_DoesNotDeletePodConnection()
    {
        var livePodId = Guid.NewGuid();
        var iterationCompleted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _cache.Setup(c => c.GetAllHealthMessages())
            .Callback(() => iterationCompleted.TrySetResult())
            .ReturnsAsync(new List<HealthMessage>
            {
                new() { PodId = livePodId.ToString(), Timestamp = DateTimeOffset.UtcNow }
            });

        var sut = new PodHealthChecker(_cache.Object, _logger, BuildOptions(60, 60));

        await RunOnceAsync(sut, iterationCompleted.Task);

        _cache.Verify(c => c.DeletePodConnection(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_WhenPodIdIsInvalidGuid_SkipsWithoutCrashing()
    {
        var iterationCompleted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _cache.Setup(c => c.GetAllHealthMessages())
            .Callback(() => iterationCompleted.TrySetResult())
            .ReturnsAsync(new List<HealthMessage>
            {
                new() { PodId = "not-a-guid", Timestamp = DateTimeOffset.UtcNow.AddSeconds(-300) }
            });

        var sut = new PodHealthChecker(_cache.Object, _logger, BuildOptions(60, 60));

        await RunOnceAsync(sut, iterationCompleted.Task);

        _cache.Verify(c => c.DeletePodConnection(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_WhenGetAllHealthMessagesThrows_DoesNotPropagate()
    {
        var iterationCompleted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _cache.Setup(c => c.GetAllHealthMessages())
            .Callback(() => iterationCompleted.TrySetResult())
            .ThrowsAsync(new InvalidOperationException("boom"));

        var sut = new PodHealthChecker(_cache.Object, _logger, BuildOptions(60, 60));

        // Should not throw; failure inside the loop is logged and the next iteration is attempted.
        await RunOnceAsync(sut, iterationCompleted.Task);
    }

    [Fact]
    public async Task ExecuteAsync_WhenDisabled_DoesNotQueryCache()
    {
        var sut = new PodHealthChecker(_cache.Object, _logger, BuildOptions(60, 60, enabled: false));

        await RunOnceAsync(sut);

        _cache.Verify(c => c.GetAllHealthMessages(), Times.Never);
        _cache.Verify(c => c.DeletePodConnection(It.IsAny<Guid>()), Times.Never);
    }
}
