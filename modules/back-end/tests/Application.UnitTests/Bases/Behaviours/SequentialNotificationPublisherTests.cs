using Application.Bases.Behaviours;
using Mediator;

namespace Application.UnitTests.Bases.Behaviours;

public class SequentialNotificationPublisherTests
{
    public class Notified : INotification;

    private sealed class Handler(Func<ValueTask> handle) : INotificationHandler<Notified>
    {
        public ValueTask Handle(Notified notification, CancellationToken cancellationToken) => handle();
    }

    private readonly SequentialNotificationPublisher _sut = new();

    private static NotificationHandlers<Notified> HandlersOf(params INotificationHandler<Notified>[] handlers)
        => new(handlers, isArray: true);

    [Fact]
    public async Task Publish_SeveralHandlers_AwaitsEachBeforeStartingTheNext()
    {
        var calls = new List<string>();
        var firstCanFinish = new TaskCompletionSource();
        var handlers = HandlersOf(
            new Handler(async () =>
            {
                calls.Add("first started");
                await firstCanFinish.Task;
                calls.Add("first finished");
            }),
            new Handler(() =>
            {
                calls.Add("second");
                return ValueTask.CompletedTask;
            }));

        var publishing = _sut.Publish(handlers, new Notified(), CancellationToken.None).AsTask();

        Assert.Equal(["first started"], calls);
        Assert.False(publishing.IsCompleted);

        firstCanFinish.SetResult();
        await publishing;

        Assert.Equal(["first started", "first finished", "second"], calls);
    }

    [Fact]
    public async Task Publish_AHandlerThrows_StopsThereAndPropagatesTheOriginalException()
    {
        var calls = new List<string>();
        var thrown = new InvalidOperationException("second handler failed");
        var handlers = HandlersOf(
            new Handler(() =>
            {
                calls.Add("first");
                return ValueTask.CompletedTask;
            }),
            new Handler(async () =>
            {
                calls.Add("second");
                await Task.Yield();
                throw thrown;
            }),
            new Handler(() =>
            {
                calls.Add("third");
                return ValueTask.CompletedTask;
            }));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => _sut.Publish(handlers, new Notified(), CancellationToken.None).AsTask());

        Assert.Same(thrown, ex);
        Assert.Equal(["first", "second"], calls);
    }

    [Fact]
    public async Task Publish_HandlersReceiveTheNotificationAndToken()
    {
        var notification = new Notified();
        using var cts = new CancellationTokenSource();
        var seen = new List<(Notified, CancellationToken)>();
        var recording = new Mock<INotificationHandler<Notified>>();
        recording
            .Setup(h => h.Handle(It.IsAny<Notified>(), It.IsAny<CancellationToken>()))
            .Callback<Notified, CancellationToken>((n, ct) => seen.Add((n, ct)))
            .Returns(ValueTask.CompletedTask);

        await _sut.Publish(HandlersOf(recording.Object, recording.Object), notification, cts.Token);

        Assert.Equal([(notification, cts.Token), (notification, cts.Token)], seen);
    }

    [Fact]
    public async Task Publish_NoHandlers_Completes()
    {
        var publishing = _sut.Publish(HandlersOf(), new Notified(), CancellationToken.None).AsTask();

        Assert.True(publishing.IsCompletedSuccessfully);
        await publishing;
    }
}
