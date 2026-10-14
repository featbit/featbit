using Domain.Observability;

namespace Infrastructure.UnitTests;

/// <summary>
/// Serializes tests that register or remove the process-wide activity correlation listener.
/// </summary>
/// <remarks>
/// <see cref="ActivityCorrelation"/> owns one global listener. Tests that toggle it must not run
/// alongside tests that need an activity to be sampled, or a valid publish activity can disappear
/// between setup and assertion.
/// </remarks>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class ActivityCorrelationCollection
{
    public const string Name = "Infrastructure activity correlation";
}
