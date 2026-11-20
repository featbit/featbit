using Infrastructure.Store;

namespace Infrastructure.UnitTests.Store;

public class StoreAvailabilityHysteresisTests
{
    private const string Redis = Stores.Redis;
    private const string Postgres = Stores.Postgres;

    private static readonly DateTimeOffset Start = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private readonly StoreAvailabilityHysteresis _hysteresis = new([Redis, Postgres], 3, 5, TimeSpan.FromSeconds(60));

    private StoreAvailabilityDecision Observe(string? observed, int secondsFromStart = 0) =>
        _hysteresis.Observe(observed, Start.AddSeconds(secondsFromStart));

    [Fact]
    public void StartsOnTheHighestPriorityStore() => Assert.Equal(Redis, _hysteresis.Reported);

    [Fact]
    public void CheckFindingTheReportedStore_IsUnchanged()
    {
        Assert.Equal(StoreAvailabilityDecisionKind.Unchanged, Observe(Redis).Kind);
        Assert.Equal(Redis, _hysteresis.Reported);
    }

    [Fact]
    public void OneFailedCheck_DoesNotChangeTheStore()
    {
        var decision = Observe(Postgres);

        Assert.Equal(StoreAvailabilityDecisionKind.HeldByThreshold, decision.Kind);
        Assert.Equal(Redis, _hysteresis.Reported);
    }

    [Fact]
    public void ThreeConsecutiveFailedChecks_FallBack()
    {
        Observe(Postgres);
        Observe(Postgres);

        var decision = Observe(Postgres);

        Assert.Equal(StoreAvailabilityDecisionKind.Changed, decision.Kind);
        Assert.Equal(Redis, decision.Previous);
        Assert.Equal(Postgres, _hysteresis.Reported);
    }

    [Fact]
    public void AnAnsweringCheckBetweenFailures_RestartsTheRun()
    {
        Observe(Postgres);
        Observe(Postgres);
        Observe(Redis);
        Observe(Postgres);
        Observe(Postgres);

        Assert.Equal(Redis, _hysteresis.Reported);
    }

    [Fact]
    public void AStoreFailingEveryOtherCheck_NeverChangesTheStore()
    {
        for (var i = 0; i < 50; i++)
        {
            Observe(i % 2 == 0 ? Postgres : Redis, i * 6);
        }

        Assert.Equal(Redis, _hysteresis.Reported);
    }

    [Fact]
    public void FallingForward_NeedsFiveChecksAndTheMinimumDwell()
    {
        Observe(Postgres, 6);
        Observe(Postgres, 12);
        Observe(Postgres, 18);
        Assert.Equal(Postgres, _hysteresis.Reported);

        // five healthy checks, but only 30 seconds after the change at second 18
        for (var i = 1; i <= 4; i++)
        {
            Assert.Equal(StoreAvailabilityDecisionKind.HeldByThreshold, Observe(Redis, 18 + i * 6).Kind);
        }

        Assert.Equal(StoreAvailabilityDecisionKind.HeldByDwell, Observe(Redis, 48).Kind);
        Assert.Equal(Postgres, _hysteresis.Reported);

        // the dwell has passed
        var decision = Observe(Redis, 79);

        Assert.Equal(StoreAvailabilityDecisionKind.Changed, decision.Kind);
        Assert.Equal(Redis, _hysteresis.Reported);
    }

    [Fact]
    public void TheFirstChangeAfterStartup_IsNotDelayedByTheDwell()
    {
        Observe(Postgres, 1);
        Observe(Postgres, 2);

        Assert.Equal(StoreAvailabilityDecisionKind.Changed, Observe(Postgres, 3).Kind);
    }

    [Fact]
    public void AnInconclusiveCheck_LeavesTheRunAsItWas()
    {
        Observe(Postgres);
        Observe(Postgres);

        Assert.Equal(StoreAvailabilityDecisionKind.Inconclusive, Observe(null).Kind);
        Assert.Equal(StoreAvailabilityDecisionKind.Changed, Observe(Postgres).Kind);
    }

    [Fact]
    public void NoStoreAnswering_RanksBelowEveryStore()
    {
        Observe(Stores.None);
        Observe(Stores.None);

        Assert.Equal(StoreAvailabilityDecisionKind.Changed, Observe(Stores.None).Kind);
        Assert.Equal(Stores.None, _hysteresis.Reported);
    }

    [Fact]
    public void FailuresToDifferentLowerStores_CountAsOneRun()
    {
        Observe(Postgres);
        Observe(Stores.None);

        Assert.Equal(StoreAvailabilityDecisionKind.Changed, Observe(Postgres).Kind);
        Assert.Equal(Postgres, _hysteresis.Reported);
    }
}
