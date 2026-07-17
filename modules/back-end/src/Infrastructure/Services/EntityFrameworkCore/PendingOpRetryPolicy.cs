namespace Infrastructure.Services.EntityFrameworkCore;

/// <summary>
/// Shared retry/backoff policy for the EF committed-vs-pending optimistic-concurrency loops in
/// FeatureFlagService/SegmentService (SetPendingAsync/PromotePendingAsync). Consolidates the
/// budget and the rationale in one place (#107, completing #108 cleanup item 6).
///
/// Rationale for the budget: a racing writer that wins the row makes SaveChanges throw
/// DbUpdateConcurrencyException (Postgres xmin token, #72/#76). Each conflict means another
/// writer just committed ahead of us, so the version/monotonicity guards converge fast — a
/// losing racer typically resolves within one or two retries. Under a synchronized ("lock-step")
/// herd of racers that all read-then-write in the same instant, though, the original budget of 3
/// retries could genuinely exhaust (~1-in-5 observed under stress) before the herd thinned out.
/// Raised to 8 retries with jittered backoff between attempts to push exhaustion from a realistic
/// event down to effectively unreachable, while keeping the worst-case wall-clock bounded: with
/// backoff = Random(10, 50)ms * attemptNumber, the cumulative worst case across 8 attempts is
/// sum(10..50 * n) for n in 1..8, i.e. roughly 0.4s-1.8s total.
///
/// If the budget is ever exhausted anyway (pathological contention), the caller logs an ERROR
/// with actionable context and rethrows — see FeatureFlagService/SegmentService SetPendingAsync.
/// The residual edge (an orphaned Redis stage, GC'd by StagedFlagGc) is documented in
/// e2e/control-plane/00-Docs/GATED-COMMIT-CONSISTENCY.md under Known limitations.
/// </summary>
internal static class PendingOpRetryPolicy
{
    public const int MaxRetries = 8;

    /// <summary>
    /// Jittered backoff before the next attempt. <paramref name="attemptNumber"/> is 1-based (the
    /// retry about to be made), so the very first backoff is never a zero-length delay.
    /// </summary>
    public static Task DelayAsync(int attemptNumber) => Task.Delay(Random.Shared.Next(10, 50) * attemptNumber);
}
