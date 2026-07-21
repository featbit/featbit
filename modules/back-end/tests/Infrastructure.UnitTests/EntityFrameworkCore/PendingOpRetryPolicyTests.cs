using System.Diagnostics;
using Infrastructure.Services.EntityFrameworkCore;

namespace Infrastructure.UnitTests.EntityFrameworkCore;

/// <summary>
/// #107/#108: deterministic, no-real-infra unit coverage for the shared retry budget/backoff that
/// FeatureFlagService and SegmentService's SetPendingAsync/PromotePendingAsync rely on. This is
/// the fallback check called out by #107's plan for "assert via the shared constants class that
/// budget/backoff are wired" — a genuine forced-conflict exhaustion integration test was attempted
/// and dropped as unreliable without a production testing seam (see the comment at the end of
/// FeatureFlagRetryOnConflictPostgresTests for why). The reliability half of the fix (no lock-step
/// herd should exhaust the budget) is covered by the lock-step herd stress tests in both
/// FeatureFlagRetryOnConflictPostgresTests and SegmentRetryOnConflictPostgresTests
/// (Application.IntegrationTests, real Postgres).
/// </summary>
public class PendingOpRetryPolicyTests
{
    [Fact]
    public void MaxRetries_Is_Eight()
    {
        // Raised from 3 (#107) so a synchronized ("lock-step") herd of racers has enough budget
        // to converge instead of occasionally exhausting (~1-in-5 observed at the old budget).
        Assert.Equal(8, PendingOpRetryPolicy.MaxRetries);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(8)]
    public async Task DelayAsync_Waits_Within_The_Documented_Jitter_Range(int attemptNumber)
    {
        // Documented formula: Random.Shared.Next(10, 50) * attemptNumber milliseconds, so the
        // elapsed wall-clock time should fall within [10 * attemptNumber, 50 * attemptNumber),
        // with generous slack on both sides for scheduler/timer overhead so this stays
        // non-flaky under CI load.
        var minExpectedMs = 10 * attemptNumber;
        var maxExpectedMs = 50 * attemptNumber;

        var stopwatch = Stopwatch.StartNew();
        await PendingOpRetryPolicy.DelayAsync(attemptNumber);
        stopwatch.Stop();

        Assert.True(
            stopwatch.ElapsedMilliseconds >= minExpectedMs - 5,
            $"Expected at least ~{minExpectedMs}ms, got {stopwatch.ElapsedMilliseconds}ms for attempt {attemptNumber}.");
        Assert.True(
            stopwatch.ElapsedMilliseconds <= maxExpectedMs + 250,
            $"Expected at most ~{maxExpectedMs}ms (+ scheduler slack), got {stopwatch.ElapsedMilliseconds}ms for attempt {attemptNumber}.");
    }

    [Fact]
    public void MaxRetries_Bounds_Worst_Case_Backoff_To_A_Couple_Seconds()
    {
        // Sanity-check the "bounded worst-case ~1-2s" claim in PendingOpRetryPolicy's doc comment:
        // sum of the maximum possible backoff (just under 50ms * attemptNumber) across all
        // MaxRetries attempts stays in the low single-digit seconds, not runaway.
        var worstCaseMs = Enumerable.Range(1, PendingOpRetryPolicy.MaxRetries).Sum(attempt => 49 * attempt);

        Assert.True(
            worstCaseMs < 3000,
            $"Worst-case cumulative backoff across {PendingOpRetryPolicy.MaxRetries} attempts was " +
            $"{worstCaseMs}ms, expected it to stay comfortably under 3s.");
    }
}
