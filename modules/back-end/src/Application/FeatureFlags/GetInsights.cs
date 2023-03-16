using Application.Bases;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class GetInsights : IRequest<IEnumerable<InsightsVm>>
{
    public Guid EnvId { get; set; }
    public StatsByVariationFilter Filter { get; set; }
}

public class GetInsightsValidator : AbstractValidator<GetInsights>
{
    public GetInsightsValidator()
    {
        RuleFor(x => x.Filter.FeatureFlagKey)
            .NotEmpty().WithErrorCode(ErrorCodes.KeyIsRequired);

        RuleFor(x => x.Filter.IntervalType)
            .Must(IntervalType.IsDefined).WithErrorCode(ErrorCodes.InvalidIntervalType);
        
        RuleFor(x => x.Filter.From)
            .GreaterThan(0).WithErrorCode(ErrorCodes.InvalidFrom);
        
        RuleFor(x => x.Filter.To)
            .GreaterThan(0).WithErrorCode(ErrorCodes.InvalidTo);
    }
}

public class GetInsightsHandler : IRequestHandler<GetInsights, IEnumerable<InsightsVm>>
{
    private readonly IFeatureFlagService _service;
    private readonly IOlapService _olapService;

    public GetInsightsHandler(IFeatureFlagService service, IOlapService olapService)
    {
        _service = service;
        _olapService = olapService;
    }
    
    public async Task<IEnumerable<InsightsVm>> Handle(GetInsights request, CancellationToken cancellationToken)
    {
        var featureFlag = await _service.GetAsync(request.EnvId, request.Filter.FeatureFlagKey);
        
        var param = new InsightsParam
        {
            EnvId = request.EnvId,
            FlagExptId = $"{request.EnvId}-{request.Filter.FeatureFlagKey}",
            IntervalType = request.Filter.IntervalType,
            StartTime = request.Filter.From,
            EndTime = request.Filter.To
        };

        var stats = await _olapService.GetFeatureFlagInsights(param);
        
        return stats.Select(s => new InsightsVm
        {
            Time = s.Time,
            Variations = featureFlag.Variations.Select(v => new VariationInsightsVm
            {
                Variation = v.Value,
                Count = s.Variations.FirstOrDefault(x => x.Id == v.Id)?.Val ?? 0
            })
        });
    }
}

