using Application.Bases;

namespace Application.FeatureFlags;

public class GetStatsByVariation : IRequest<IEnumerable<StatsByVariationVm>>
{
    public Guid EnvId { get; set; }

    public StatsByVariationFilter Filter { get; set; }
    
}

public class GetStatsByVariationValidator : AbstractValidator<GetStatsByVariation>
{
    public GetStatsByVariationValidator()
    {
        RuleFor(x => x.Filter.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.FeatureFlagKeyIsRequired);

        RuleFor(x => x.Filter.IntervalType)
            .Must(IntervalType =>
            {
                return IntervalTypeEnum.Month == IntervalType || IntervalTypeEnum.Week == IntervalType ||
                       IntervalTypeEnum.Day == IntervalType || IntervalTypeEnum.Hour == IntervalType ||
                       IntervalTypeEnum.Minute == IntervalType;
            }).WithErrorCode(ErrorCodes.IntervalTypeIsRequired);
        
        RuleFor(x => x.Filter.From)
            .NotEmpty().WithErrorCode(ErrorCodes.StatsFromIsRequired);
    }
}

public class GetStatsByVariationHandler : IRequestHandler<GetStatsByVariation, IEnumerable<StatsByVariationVm>>
{
    private readonly IFeatureFlagService _service;

    public GetStatsByVariationHandler(IFeatureFlagService service)
    {
        _service = service;
    }
    
    public async Task<IEnumerable<StatsByVariationVm>> Handle(GetStatsByVariation request, CancellationToken cancellationToken)
    {
        var featureFlag = await _service.GetAsync(request.EnvId, request.Filter.Key);
        
        var stats = await _service.GetStatsByVariationAsync(request.EnvId, request.Filter);

        return stats.Select(s => new StatsByVariationVm
        {
            Time = s.Time,
            Variations = s.Variations.Select(v => new VariationStatsVm
            {
                Id = v.Id,
                Value = featureFlag.Variations.FirstOrDefault(x => x.Id == v.Id)?.Value,
                Count = v.Val
            })
        });
    }
}

