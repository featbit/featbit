namespace Infrastructure.Store;

/// <summary>
/// Decides, one check at a time, which store the <see cref="StoreAvailableSentinel"/> reports as available.
/// It does no I/O and reads no clock, so every sequence of checks is unit-testable.
/// </summary>
/// <remarks>
/// <para>
/// A single check never changes the reported store. The reported store moves to a lower-priority store (or
/// to <see cref="Stores.None"/>) only after <c>failureThreshold</c> consecutive checks found it worse off,
/// and back to a higher-priority store only after <c>recoveryThreshold</c> consecutive checks found that
/// store answering; and never sooner than <c>minimumDwell</c> after its last change. A run counts the
/// direction of the evidence, not one particular store.
/// </para>
/// <para>
/// An inconclusive check (one this pod was too busy to time) is neither evidence for nor against the
/// reported store: it leaves the runs as they were.
/// </para>
/// </remarks>
public sealed class StoreAvailabilityHysteresis
{
    private readonly IReadOnlyList<string> _storesByPriority;
    private readonly int _failureThreshold;
    private readonly int _recoveryThreshold;
    private readonly TimeSpan _minimumDwell;

    private Direction _runDirection;
    private int _runLength;
    private DateTimeOffset? _lastChangeAt;

    public StoreAvailabilityHysteresis(
        IReadOnlyList<string> storesByPriority,
        int failureThreshold,
        int recoveryThreshold,
        TimeSpan minimumDwell)
    {
        _storesByPriority = storesByPriority;
        _failureThreshold = failureThreshold;
        _recoveryThreshold = recoveryThreshold;
        _minimumDwell = minimumDwell;

        Reported = storesByPriority.Count > 0 ? storesByPriority[0] : Stores.None;
    }

    /// <summary>The store reported as available: the highest-priority store, assumed, until a check says otherwise.</summary>
    public string Reported { get; private set; }

    /// <summary>Takes one check's finding into account.</summary>
    /// <param name="observed">
    /// The highest-priority store that answered, <see cref="Stores.None"/> when none did, or <c>null</c>
    /// when the check was inconclusive.
    /// </param>
    /// <param name="now">When the check finished; used only for the minimum dwell.</param>
    public StoreAvailabilityDecision Observe(string? observed, DateTimeOffset now)
    {
        if (observed is null)
        {
            return Decide(StoreAvailabilityDecisionKind.Inconclusive, Reported, observed);
        }

        if (observed == Reported)
        {
            ResetRun();
            return Decide(StoreAvailabilityDecisionKind.Unchanged, Reported, observed);
        }

        var direction = Rank(observed) < Rank(Reported) ? Direction.Better : Direction.Worse;
        if (direction != _runDirection)
        {
            _runDirection = direction;
            _runLength = 0;
        }

        _runLength++;

        var threshold = direction == Direction.Better ? _recoveryThreshold : _failureThreshold;
        if (_runLength < threshold)
        {
            return Decide(StoreAvailabilityDecisionKind.HeldByThreshold, Reported, observed);
        }

        if (_lastChangeAt is { } lastChangeAt && now - lastChangeAt < _minimumDwell)
        {
            return Decide(StoreAvailabilityDecisionKind.HeldByDwell, Reported, observed);
        }

        var previous = Reported;
        Reported = observed;
        _lastChangeAt = now;
        ResetRun();

        return Decide(StoreAvailabilityDecisionKind.Changed, previous, observed);
    }

    private StoreAvailabilityDecision Decide(StoreAvailabilityDecisionKind kind, string previous, string? observed) =>
        new(kind, previous, Reported, observed);

    private void ResetRun()
    {
        _runDirection = Direction.None;
        _runLength = 0;
    }

    // Stores.None, and anything unregistered, ranks below every registered store.
    private int Rank(string store)
    {
        for (var i = 0; i < _storesByPriority.Count; i++)
        {
            if (_storesByPriority[i] == store)
            {
                return i;
            }
        }

        return int.MaxValue;
    }

    private enum Direction
    {
        None,
        Better,
        Worse
    }
}

/// <summary>What one check led the <see cref="StoreAvailabilityHysteresis"/> to do.</summary>
/// <param name="Kind">The decision.</param>
/// <param name="Previous">The store reported before the check.</param>
/// <param name="Reported">The store reported after it.</param>
/// <param name="Observed">What the check found; <c>null</c> when it was inconclusive.</param>
public readonly record struct StoreAvailabilityDecision(
    StoreAvailabilityDecisionKind Kind,
    string Previous,
    string Reported,
    string? Observed);

public enum StoreAvailabilityDecisionKind
{
    /// <summary>The check found the reported store.</summary>
    Unchanged,

    /// <summary>The reported store changed.</summary>
    Changed,

    /// <summary>The check disagreed, but not for enough consecutive checks yet.</summary>
    HeldByThreshold,

    /// <summary>Enough checks disagreed, but the last change was too recent.</summary>
    HeldByDwell,

    /// <summary>The check could not tell, because this pod was too busy to time it.</summary>
    Inconclusive
}
