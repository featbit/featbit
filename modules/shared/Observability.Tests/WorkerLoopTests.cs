using Domain.Observability;

namespace FeatBit.Observability.Tests;

/// <summary>
/// Pins the behavior that makes a crashed background loop visible to the host.
/// </summary>
/// <remarks>
/// <para>
/// Both Kafka consumers used to return <c>Task.Factory.StartNew(asyncDelegate, …)</c> directly from
/// <c>ExecuteAsync</c>. That returns a task whose result is the real loop task, so it completed
/// almost immediately and any exception escaping the loop was stored on an inner task nobody
/// awaited. The pod stayed <c>Ready</c> while consuming nothing.
/// </para>
/// <para>
/// The failure had no symptom a test at the call site could see, which is why the loop-starting
/// behavior is a named helper: these tests assert the property directly, and both consumers get it
/// by construction.
/// </para>
/// </remarks>
public sealed class WorkerLoopTests
{
    [Fact]
    public async Task Run_WhenTheLoopThrowsAfterAwaiting_ReturnsAFaultedTask()
    {
        // The exact regression. Without Unwrap this task completes successfully and the exception
        // is swallowed, so the host never stops the service.
        var task = WorkerLoop.Run(async () =>
        {
            await Task.Yield();
            throw new InvalidOperationException("broker gone");
        });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => task);

        Assert.Equal("broker gone", ex.Message);
        Assert.True(task.IsFaulted);
    }

    [Fact]
    public async Task Run_WhenTheLoopThrowsSynchronously_ReturnsAFaultedTask()
    {
        var task = WorkerLoop.Run(() => throw new InvalidOperationException("subscribe failed"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => task);

        Assert.True(task.IsFaulted);
    }

    [Fact]
    public async Task Run_WhileTheLoopIsStillRunning_DoesNotComplete()
    {
        // The other half of the same bug: the host must not see the service as finished while the
        // loop is still going, or shutdown will not wait for it to drain.
        using var release = new SemaphoreSlim(0, 1);

        var task = WorkerLoop.Run(async () =>
        {
            await release.WaitAsync();
        });

        await Task.Delay(50);
        Assert.False(task.IsCompleted);

        release.Release();
        await task;

        Assert.True(task.IsCompletedSuccessfully);
    }

    [Fact]
    public async Task Run_WhenTheLoopCompletes_CompletesSuccessfully()
    {
        var ran = false;

        await WorkerLoop.Run(async () =>
        {
            await Task.Yield();
            ran = true;
        });

        Assert.True(ran);
    }

    [Fact]
    public async Task Run_WhenTheLoopIsCanceled_SurfacesTheCancellation()
    {
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        var task = WorkerLoop.Run(async () =>
        {
            await Task.Yield();
            cts.Token.ThrowIfCancellationRequested();
        });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => task);
    }

    [Fact]
    public async Task Run_ForABlockingLoop_DoesNotOccupyAThreadPoolThread()
    {
        // The loop blocks synchronously for long stretches (a Kafka Consume call), so running it on
        // a pool thread would starve the pool. LongRunning gives it a dedicated thread.
        var isThreadPoolThread = true;

        await WorkerLoop.Run(async () =>
        {
            isThreadPoolThread = Thread.CurrentThread.IsThreadPoolThread;
            await Task.CompletedTask;
        });

        Assert.False(isThreadPoolThread);
    }

    [Fact]
    public void Run_WithoutALoop_Throws()
    {
        // Discarding the result keeps this an Action, so xUnit does not route it to the async
        // overload and warn that the returned task is never awaited.
        Assert.Throws<ArgumentNullException>(() => { _ = WorkerLoop.Run(null!); });
    }
}
