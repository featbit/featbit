using System.Diagnostics;

namespace Infrastructure.Store;

/// <summary>
/// Tells whether this process's thread pool picked up a work item promptly, as a stand-in for whether a
/// store check's own continuations could have run in time.
/// </summary>
internal interface IThreadPoolProbe
{
    /// <summary>
    /// Whether the work item ran within <paramref name="limit"/> of being queued. Waits until it has run
    /// or the limit has passed.
    /// </summary>
    bool RanWithin(TimeSpan limit);
}

/// <summary>
/// Queues one trivial work item to the thread pool when started and records when it ran.
/// </summary>
/// <remarks>
/// A store check is an async call whose continuations run on the thread pool. When the pool is saturated
/// those continuations queue behind everything else, and the check misses its budget even though the store
/// answered. A work item queued at the start of the check waits in the same queue, so if it hasn't run
/// either, the timeout says more about this pod than about the store.
/// </remarks>
internal sealed class ThreadPoolProbe : IThreadPoolProbe
{
    private readonly long _queuedAt = Stopwatch.GetTimestamp();

    // never disposed: the work item may still set it after the check has stopped waiting
    private readonly ManualResetEventSlim _ran = new();
    private long _ranAt;

    private ThreadPoolProbe()
    {
    }

    public static IThreadPoolProbe Start()
    {
        var probe = new ThreadPoolProbe();
        ThreadPool.UnsafeQueueUserWorkItem(static p => p.MarkRan(), probe, preferLocal: false);

        return probe;
    }

    public bool RanWithin(TimeSpan limit)
    {
        var remaining = limit - Stopwatch.GetElapsedTime(_queuedAt);
        if (remaining > TimeSpan.Zero)
        {
            _ran.Wait(remaining);
        }

        return _ran.IsSet && Stopwatch.GetElapsedTime(_queuedAt, Interlocked.Read(ref _ranAt)) <= limit;
    }

    private void MarkRan()
    {
        Interlocked.Exchange(ref _ranAt, Stopwatch.GetTimestamp());
        _ran.Set();
    }
}
