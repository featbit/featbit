using Application.Bases.Exceptions;
using Domain.FeatureFlags;

namespace Application.Experiments;

/// <summary>
/// Experiments need insight data, so insights cannot be disabled on a flag while an experiment is running.
/// The opposite direction (no run may start while insights are off) is enforced by the experiment services via
/// <c>ExperimentFlagBinding.EnsureInsightsEnabled</c>.
/// </summary>
public interface IFlagInsightsGuard
{
    /// <summary>
    /// Throws <see cref="InsightsRequiredByExperimentException"/> when the change turns insights off on a flag
    /// with a running experiment. Other transitions are always allowed.
    /// </summary>
    Task EnsureCanDisableInsightsAsync(FeatureFlag before, FeatureFlag after);

    /// <inheritdoc cref="EnsureCanDisableInsightsAsync(FeatureFlag, FeatureFlag)"/>
    Task EnsureCanDisableInsightsAsync(bool wasEnabled, FeatureFlag after);
}

public class FlagInsightsGuard(IExperimentService experimentService, TimeProvider timeProvider) : IFlagInsightsGuard
{
    public Task EnsureCanDisableInsightsAsync(FeatureFlag before, FeatureFlag after) =>
        EnsureCanDisableInsightsAsync(before.InsightsEnabled, after);

    public async Task EnsureCanDisableInsightsAsync(bool wasEnabled, FeatureFlag after)
    {
        if (!wasEnabled || after.InsightsEnabled)
        {
            return;
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var running = await experimentService.GetRunningForFlagAsync(after.EnvId, after.Id, now);
        if (running.Count > 0)
        {
            throw new InsightsRequiredByExperimentException(running);
        }
    }
}
