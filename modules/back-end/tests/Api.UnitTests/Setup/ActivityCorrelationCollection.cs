using Domain.Observability;

namespace Api.UnitTests.Setup;

/// <summary>
/// Groups the tests that register and remove the process-wide correlation listener.
/// </summary>
/// <remarks>
/// <see cref="ActivityCorrelation"/> registers a single listener for the whole process, so two test
/// classes toggling it in parallel would tear it out from under each other and fail intermittently.
/// xUnit runs the classes in one collection sequentially, which removes the race.
/// </remarks>
[CollectionDefinition(Name)]
public sealed class ActivityCorrelationCollection
{
    public const string Name = "ActivityCorrelation";
}
