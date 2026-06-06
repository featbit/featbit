using Application.Bases;
using Domain.FeatureFlags;
using Microsoft.Extensions.Configuration;

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
            .NotEmpty().WithErrorCode(ErrorCodes.Required("featureFlagKey"));

        RuleFor(x => x.Filter.IntervalType)
            .Must(IntervalType.IsDefined).WithErrorCode(ErrorCodes.Invalid("intervalType"));

        RuleFor(x => x.Filter.From)
            .GreaterThan(0).WithErrorCode(ErrorCodes.Invalid("from"));

        RuleFor(x => x.Filter.To)
            .GreaterThan(0).WithErrorCode(ErrorCodes.Invalid("to"));
    }
}

public class GetInsightsHandler : IRequestHandler<GetInsights, IEnumerable<InsightsVm>>
{
    private const string FeatureFlagInsightsProviderApi = "featbit-api";
    private const string FeatureFlagInsightsProviderDas = "featbit-das";

    private readonly IFeatureFlagService _service;
    private readonly IOlapService _olapService;
    private readonly IFeatureFlagInsightsService _insightsService;
    private readonly IConfiguration _configuration;

    public GetInsightsHandler(
        IFeatureFlagService service,
        IOlapService olapService,
        IFeatureFlagInsightsService insightsService,
        IConfiguration configuration)
    {
        _service = service;
        _olapService = olapService;
        _insightsService = insightsService;
        _configuration = configuration;
    }

    public async Task<IEnumerable<InsightsVm>> Handle(GetInsights request, CancellationToken cancellationToken)
    {
        var featureFlag = await _service.GetAsync(request.EnvId, request.Filter.FeatureFlagKey);

        var stats = UseApiInsights()
            ? await _insightsService.GetFeatureFlagInsightsAsync(request.EnvId, request.Filter)
            : await _olapService.GetFeatureFlagInsights(new InsightsParam
            {
                EnvId = request.EnvId,
                FlagExptId = $"{request.EnvId}-{request.Filter.FeatureFlagKey}",
                IntervalType = request.Filter.IntervalType,
                StartTime = request.Filter.From,
                EndTime = request.Filter.To
            });

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

    private bool UseApiInsights()
    {
        var provider =
            Environment.GetEnvironmentVariable("FEATURE_FLAG_INSIGHTS_PROVIDER") ??
            _configuration["FeatureFlagInsights:Provider"] ??
            FeatureFlagInsightsProviderDas;

        if (string.Equals(provider, FeatureFlagInsightsProviderApi, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (string.Equals(provider, FeatureFlagInsightsProviderDas, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        throw new InvalidOperationException(
            "Invalid feature flag insights provider. Use 'featbit-api' or 'featbit-das'.");
    }
}
