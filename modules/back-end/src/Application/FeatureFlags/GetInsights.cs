using Application.Bases;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class GetInsights : IRequest<IEnumerable<InsightsVm>>
{
    public Guid EnvId { get; set; }
    public InsightFilter Filter { get; set; }
}

public class GetInsightsValidator : AbstractValidator<GetInsights>
{
    public GetInsightsValidator()
    {
        RuleFor(x => x.Filter.FeatureFlagKey)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("featureFlagKey"));

        RuleFor(x => x.Filter.IntervalType)
            .Must(IntervalType.IsDefined).WithErrorCode(ErrorCodes.Invalid("intervalType"));

        RuleFor(x => x.Filter.From)
            .GreaterThan(0).WithErrorCode(ErrorCodes.Invalid("from"));

        RuleFor(x => x.Filter.To)
            .GreaterThan(0).WithErrorCode(ErrorCodes.Invalid("to"));
    }
}

public class GetInsightsHandler(IFeatureFlagService flagService, IInsightService insightService)
    : IRequestHandler<GetInsights, IEnumerable<InsightsVm>>
{
    public async Task<IEnumerable<InsightsVm>> Handle(GetInsights request, CancellationToken cancellationToken)
    {
        var featureFlag = await flagService.GetAsync(request.EnvId, request.Filter.FeatureFlagKey);

        var stats = await insightService.GetInsightsAsync(request.EnvId, request.Filter);

        return stats.Select(s => new InsightsVm
        {
            Time = s.Time,
            Variations = featureFlag.Variations.Select(v => new VariationInsightsVm
            {
                Variation = v.Name,
                Count = s.Variations.FirstOrDefault(x => x.Id == v.Id)?.Val ?? 0
            })
        });
    }
}
