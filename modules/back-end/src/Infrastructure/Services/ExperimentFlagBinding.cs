using Application.Bases;
using Application.Bases.Exceptions;
using Application.Services;
using Domain.Experiments;
using Domain.FeatureFlags;

namespace Infrastructure.Services;

internal static class ExperimentFlagBinding
{
    public static Task<FeatureFlag?> FindAsync(IFeatureFlagService service, Guid? envId, Guid? flagId) =>
        envId.HasValue && flagId.HasValue
            ? service.FindOneAsync(flag => flag.EnvId == envId.Value && flag.Id == flagId.Value)
            : Task.FromResult<FeatureFlag?>(null);

    public static async Task<FeatureFlag?> ValidateAsync(IFeatureFlagService service, Guid? envId, Guid? flagId)
    {
        if (!flagId.HasValue)
        {
            return null;
        }

        if (flagId == Guid.Empty)
        {
            throw new BusinessException(ErrorCodes.Invalid("flagId"));
        }

        return await FindAsync(service, envId, flagId)
            ?? throw new EntityNotFoundException(nameof(FeatureFlag), $"{envId}-{flagId}");
    }

    public static async Task<FeatureFlag> RequireAsync(IFeatureFlagService service, Guid envId, Guid? flagId) =>
        await ValidateAsync(service, envId, flagId)
        ?? throw new BusinessException(ErrorCodes.Required("flagId"));

    public static async Task<Dictionary<Guid, FeatureFlag>> LoadAsync(
        IFeatureFlagService service,
        Guid envId,
        IEnumerable<Experiment> experiments)
    {
        var ids = experiments.Where(experiment => experiment.FlagId.HasValue)
            .Select(experiment => experiment.FlagId!.Value).Distinct().ToArray();
        if (ids.Length == 0)
        {
            return [];
        }

        var flags = await service.FindManyAsync(flag => flag.EnvId == envId && ids.Contains(flag.Id));
        return flags.ToDictionary(flag => flag.Id);
    }
}
