using Application.Experiments;

namespace Application.Bases.Exceptions;

/// <summary>
/// Thrown when a change would disable insights on a feature flag that a running experiment depends on.
/// </summary>
public class InsightsRequiredByExperimentException : Exception
{
    public IReadOnlyList<ExperimentRef> Experiments { get; }

    public InsightsRequiredByExperimentException(IReadOnlyList<ExperimentRef> experiments)
        : base(ErrorCodes.InsightsRequiredByRunningExperiment)
    {
        Experiments = experiments;
    }
}
