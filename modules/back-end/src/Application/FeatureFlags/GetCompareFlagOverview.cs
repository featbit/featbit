using Application.Bases;
using Application.Bases.Models;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class GetCompareFlagOverview : IRequest<PagedResult<CompareFlagOverview>>
{
    public Guid SourceEnvId { get; set; }

    public Guid[] TargetEnvIds { get; set; }

    public FeatureFlagFilter Filter { get; set; }
}

public class GetCompareFlagOverviewValidator : AbstractValidator<GetCompareFlagOverview>
{
    public GetCompareFlagOverviewValidator()
    {
        RuleFor(x => x.SourceEnvId)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("sourceEnvId"));
        RuleFor(x => x.TargetEnvIds)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("targetEnvIds"));
    }
}

public class GetCompareFlagOverviewHandler(IFeatureFlagService service)
    : IRequestHandler<GetCompareFlagOverview, PagedResult<CompareFlagOverview>>
{
    public async Task<PagedResult<CompareFlagOverview>> Handle(GetCompareFlagOverview request, CancellationToken cancellationToken)
    {
        var pagedFlags = await service.GetListAsync(request.SourceEnvId, request.Filter);

        var flags = pagedFlags.Items;

        var flagKeys = flags.Select(x => x.Key).ToArray();
        var targetFlags = await service.FindManyAsync(x =>
            request.TargetEnvIds.Contains(x.EnvId) &&
            flagKeys.Contains(x.Key) &&
            !x.IsArchived
        );

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

                var diff = FlagDiffer.Diff(sourceFlag, targetFlag);
                overview.AddDiff(targetEnvId, diff);
            }

            overviews.Add(overview);
        }

        return new PagedResult<CompareFlagOverview>(pagedFlags.TotalCount, overviews);
    }
}