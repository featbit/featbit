using System.Text.Json;
using Domain.Resources;
using Domain.Segments;
using Domain.Targeting;

namespace Application.FeatureFlags;

public class CopyToEnvPrecheck : IRequest<ICollection<CopyToEnvPrecheckResult>>
{
    public Guid TargetEnvId { get; set; }

    public ICollection<Guid> FlagIds { get; set; } = Array.Empty<Guid>();
}

public class CopyToEnvPrecheckHandler : IRequestHandler<CopyToEnvPrecheck, ICollection<CopyToEnvPrecheckResult>>
{
    private readonly IFeatureFlagService _flagService;
    private readonly ISegmentService _segmentService;
    private readonly IResourceServiceV2 _resourceService;

    public CopyToEnvPrecheckHandler(
        IFeatureFlagService flagService,
        ISegmentService segmentService,
        IResourceServiceV2 resourceService)
    {
        _flagService = flagService;
        _segmentService = segmentService;
        _resourceService = resourceService;
    }

    public async Task<ICollection<CopyToEnvPrecheckResult>> Handle(
        CopyToEnvPrecheck request,
        CancellationToken cancellationToken)
    {
        var flags = await _flagService.FindManyAsync(x => request.FlagIds.Contains(x.Id));
        var targetFlagKeys = flags.Select(x => x.Key).ToArray();

        var duplicateKeys =
        (
            await _flagService.FindManyAsync(x => x.EnvId == request.TargetEnvId && targetFlagKeys.Contains(x.Key))
        ).Select(x => x.Key).ToArray();

        var targetEnvRN = await _resourceService.GetRNAsync(request.TargetEnvId, ResourceTypes.Env);

        var results = new List<CopyToEnvPrecheckResult>();
        foreach (var flag in flags)
        {
            var result = new CopyToEnvPrecheckResult
            {
                Id = flag.Id,
                KeyCheck = !duplicateKeys.Contains(flag.Key),
                TargetUserCheck = flag.TargetUsers.Count == 0,
                TargetRuleCheck = await CheckRules(flag.Rules)
            };

            results.Add(result);
        }

        return results;

        async ValueTask<bool> CheckRules(ICollection<TargetRule> rules)
        {
            if (rules.Count == 0)
            {
                // if there are no rules, return true
                return true;
            }

            var segmentConditions = rules.SelectMany(x => x.Conditions)
                .Where(x => x.IsSegmentCondition())
                .ToArray();
            if (segmentConditions.Length == 0)
            {
                // if there are no segment conditions, return true
                return true;
            }

            var segmentIds = segmentConditions
                .SelectMany(x => JsonSerializer.Deserialize<string[]>(x.Value))
                .Select(Guid.Parse)
                .ToArray();

            var segments = await _segmentService.FindManyAsync(x => segmentIds.Contains(x.Id));
            if (segments.Any(x => x.Type == SegmentType.EnvironmentSpecific))
            {
                // if there are environment-specific segments, return false
                return false;
            }

            var sharedSegments = segments.Where(x => x.Type == SegmentType.Shared).ToArray();
            if (sharedSegments.Any(sharedSegment => sharedSegment.Scopes.All(x => !RN.IsInScope(targetEnvRN, x))))
            {
                // if any shared segment cannot be used in target env, return false
                return false;
            }

            return true;
        }
    }
}