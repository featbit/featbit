using Application.Bases;
using Domain.FeatureFlags;

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
        RuleFor(x => x.Filter.FeatureFlagKey)
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
        
        RuleFor(x => x.Filter.To)
            .NotEmpty().WithErrorCode(ErrorCodes.StatsToIsRequired);
    }
}

public class GetStatsByVariationHandler : IRequestHandler<GetStatsByVariation, IEnumerable<StatsByVariationVm>>
{
    private readonly IFeatureFlagService _service;
    private readonly IOlapService _olapService;

    public GetStatsByVariationHandler(IFeatureFlagService service, IOlapService olapService)
    {
        _service = service;
        _olapService = olapService;
    }
    
    public async Task<IEnumerable<StatsByVariationVm>> Handle(GetStatsByVariation request, CancellationToken cancellationToken)
    {
        var featureFlag = await _service.GetAsync(request.EnvId, request.Filter.FeatureFlagKey);
        
        var param = new StatsByVariationParam
        {
            FlagExptId = $"{request.EnvId}-{request.Filter.FeatureFlagKey}",
            IntervalType = request.Filter.IntervalType,
            StartTime = request.Filter.From,
            EndTime = request.Filter.To
        };

        var stats = await _olapService.GetFeatureFlagStatusByVariation(param);

        Random rnd = new Random();
        
        return stats.Select(s => new StatsByVariationVm
        {
            Time = s.Time,
            Variations = featureFlag.Variations.Select(v => new VariationStatsVm
            {
                Variation = v.Value,
                Count = rnd.Next(0, 1000)//s.Variations.FirstOrDefault(x => x.Id == v.Id)?.Val ?? 0
            })
        });
    }
}

