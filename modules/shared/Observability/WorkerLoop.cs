#nullable enable

namespace Domain.Observability;

/// <summary>
/// Starts a long-running background loop on a dedicated thread in a way the host actually observes.
/// </summary>
/// <remarks>
/// <para>
/// This exists because getting it wrong is invisible. A <c>BackgroundService</c> whose
/// <c>ExecuteAsync</c> returns <c>Task.Factory.StartNew(asyncDelegate, …)</c> returns a
/// <see cref="Task{TResult}"/> whose result is the <i>real</i> loop task. The outer task completes
/// as soon as the delegate hands back that inner task, so the host sees the service as finished
/// while the loop is still running — and, worse, an exception escaping the loop is stored on the
/// inner task that nobody awaits. The pod stays <c>Ready</c>, the consumer is dead, and nothing
/// logs a thing.
/// </para>
/// <para>
/// <c>Unwrap()</c> is the whole fix: it projects the inner task outward, so the returned task
/// completes when the loop completes and faults when the loop faults. That is what lets
/// <c>BackgroundService</c> apply its configured
/// <c>BackgroundServiceExceptionBehavior</c> — by default, stopping the host.
/// </para>
/// <para>
/// It is a named helper rather than an inline call so the behavior can be tested once and so a
/// future edit cannot quietly drop the <c>Unwrap()</c> again. That regression produces no compile
/// error, no failing test at the call site, and no runtime symptom until a broker goes away.
/// </para>
/// </remarks>
public static class WorkerLoop
{
    /// <summary>
    /// Runs <paramref name="loop"/> on a dedicated long-running thread.
    /// </summary>
    /// <param name="loop">
    /// The loop body. Typically blocks synchronously for long stretches — a Kafka
    /// <c>Consume</c> call, for instance — which is why this does not use the thread pool.
    /// </param>
    /// <returns>
    /// A task that completes when the loop completes and <b>faults when the loop faults</b>.
    /// Return it directly from <c>ExecuteAsync</c>.
    /// </returns>
    public static Task Run(Func<Task> loop)
    {
        ArgumentNullException.ThrowIfNull(loop);

        return Task.Factory.StartNew(
            loop,
            CancellationToken.None,
            // The loop blocks for long periods, so it must not occupy a pool thread.
            TaskCreationOptions.LongRunning,
            TaskScheduler.Default
        ).Unwrap();
    }
}
