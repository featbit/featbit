using Application.Bases;
using Application.Bases.Models;

namespace Application.EndUsers;

public class GetEndUserStats : IRequest<PagedResult<EndUserStatsVm>>
{
    public Guid EnvId { get; set; }

    public EndUserStatsFilter Filter { get; set; }
}

public class GetEndUserStatsValidator : AbstractValidator<GetEndUserStats>
{
    public GetEndUserStatsValidator()
    {
        RuleFor(x => x.Filter.FeatureFlagKey)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("featureFlagKey"));

        RuleFor(x => x.Filter.From)
            .LessThanOrEqualTo(x => x.Filter.To).WithErrorCode(ErrorCodes.Invalid("from"));

        RuleFor(x => x.Filter.To)
            .GreaterThan(0).WithErrorCode(ErrorCodes.Invalid("to"));
    }
}

public class GetEndUserStatsHandler(IFeatureFlagService flagService, IEndUserStatsService endUserStatsService)
    : IRequestHandler<GetEndUserStats, PagedResult<EndUserStatsVm>>
{
    public async Task<PagedResult<EndUserStatsVm>> Handle(GetEndUserStats request, CancellationToken cancellationToken)
    {
        var flag = await flagService.GetAsync(request.EnvId, request.Filter.FeatureFlagKey);

        var stats = await endUserStatsService.GetEndUserStatsAsync(request.EnvId, request.Filter);

        var items = stats.Items.Select(it => new EndUserStatsVm
            {
                Variation = flag.Variations.FirstOrDefault(v => v.Id == it.VariationId)?.Name ?? it.VariationId,
                KeyId = it.KeyId,
                Name = it.Name,
                LastEvaluatedAt = it.LastEvaluatedAt
            }).ToList();

        return new PagedResult<EndUserStatsVm>(stats.TotalCount, items);
    }
}
