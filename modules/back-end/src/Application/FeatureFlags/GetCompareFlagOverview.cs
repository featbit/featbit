using Application.Bases;
using Application.Environments;
using Application.Bases.Models;
using Domain.FeatureFlags;
using Domain.Policies;

namespace Application.FeatureFlags;

public class GetCompareFlagOverviewPayload
{
    public Guid[] TargetEnvIds { get; set; }

    public FeatureFlagFilter Filter { get; set; }
}

public class GetCompareFlagOverview : GetCompareFlagOverviewPayload, IRequest<PagedResult<CompareFlagOverview>>
{
    public Guid OrgId { get; set; }

    public PolicyStatement[] Permissions { get; }

    public Guid SourceEnvId { get; set; }

    public GetCompareFlagOverview(
        Guid orgId,
        Guid sourceEnvId,
        PolicyStatement[] permissions,
        GetCompareFlagOverviewPayload payload)
    {
        OrgId = orgId;
        SourceEnvId = sourceEnvId;
        Permissions = permissions;

        TargetEnvIds = payload.TargetEnvIds;
        Filter = payload.Filter;
    }
}

public class GetCompareFlagOverviewValidator : AbstractValidator<GetCompareFlagOverview>
{
    public GetCompareFlagOverviewValidator()
    {
        RuleFor(x => x.SourceEnvId)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("sourceEnvId"));
        RuleFor(x => x.TargetEnvIds)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("targetEnvIds"));
        RuleForEach(x => x.TargetEnvIds)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("targetEnvIds"));
    }
}

public class GetCompareFlagOverviewHandler(IFeatureFlagService service, EnvironmentPermissionGuard envGuard)
    : IRequestHandler<GetCompareFlagOverview, PagedResult<CompareFlagOverview>>
{
    public async ValueTask<PagedResult<CompareFlagOverview>> Handle(GetCompareFlagOverview request, CancellationToken cancellationToken)
    {
        await envGuard.EnsureAccessAsync(request.OrgId, request.SourceEnvId, request.Permissions);
        foreach (var targetEnvId in request.TargetEnvIds.Distinct())
        {
            await envGuard.EnsureAccessAsync(request.OrgId, targetEnvId, request.Permissions);
        }

        var pagedFlags = await service.GetListAsync(request.SourceEnvId, request.Filter);

        var flags = pagedFlags.Items;

        var flagKeys = flags.Select(x => x.Key).ToArray();
        var targetFlags = await service.FindManyAsync(x =>
            request.TargetEnvIds.Contains(x.EnvId) &&
            flagKeys.Contains(x.Key) &&
            !x.IsArchived
        );

        var allFlags = flags.Concat(targetFlags).ToArray();
        var relatedSegments = await service.GetRelatedSegmentsAsync(allFlags);

        var overviews = new List<CompareFlagOverview>();
        foreach (var sourceFlag in flags)
        {
            var overview = new CompareFlagOverview(sourceFlag);

            foreach (var targetEnvId in request.TargetEnvIds)
            {
                var targetFlag = targetFlags.FirstOrDefault(x =>
                    x.EnvId == targetEnvId &&
                    x.Key == sourceFlag.Key
                );

                if (targetFlag == null)
                {
                    continue;
                }

                var diff = FlagDiffer.Diff(sourceFlag, targetFlag, relatedSegments);
                overview.AddDiff(targetEnvId, diff);
            }

            overviews.Add(overview);
        }

        return new PagedResult<CompareFlagOverview>(pagedFlags.TotalCount, overviews);
    }
}
