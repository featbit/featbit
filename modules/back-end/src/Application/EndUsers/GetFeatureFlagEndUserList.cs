using Application.Bases;
using Application.Bases.Models;
using Domain.FeatureFlags;
using Microsoft.Extensions.Configuration;

namespace Application.EndUsers;

public class GetFeatureFlagEndUserList : IRequest<PagedResult<FeatureFlagEndUserStatsVm>>
{
    public Guid EnvId { get; set; }

    public FeatureFlagEndUserFilter Filter { get; set; }
}

public class GetFeatureFlagEndUserListValidator : AbstractValidator<GetFeatureFlagEndUserList>
{
    public GetFeatureFlagEndUserListValidator()
    {
        RuleFor(x => x.Filter.FeatureFlagKey)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("featureFlagKey"));

        RuleFor(x => x.Filter.From)
            .GreaterThan(0).WithErrorCode(ErrorCodes.Invalid("from"));

        RuleFor(x => x.Filter.To)
            .GreaterThan(0).WithErrorCode(ErrorCodes.Invalid("to"));
    }
}

public class
    GetFeatureFlagEndUserListHandler : IRequestHandler<GetFeatureFlagEndUserList,
    PagedResult<FeatureFlagEndUserStatsVm>>
{
    private const string FeatureFlagInsightsProviderApi = "featbit-api";
    private const string FeatureFlagInsightsProviderDas = "featbit-das";

    private readonly IFeatureFlagService _featureFlagService;
    private readonly IOlapService _olapService;
    private readonly IFeatureFlagEndUserStatsService _endUserStatsService;
    private readonly IConfiguration _configuration;

    public GetFeatureFlagEndUserListHandler(
        IFeatureFlagService featureFlagService,
        IOlapService olapService,
        IFeatureFlagEndUserStatsService endUserStatsService,
        IConfiguration configuration)
    {
        _featureFlagService = featureFlagService;
        _olapService = olapService;
        _endUserStatsService = endUserStatsService;
        _configuration = configuration;
    }

    public async Task<PagedResult<FeatureFlagEndUserStatsVm>> Handle(GetFeatureFlagEndUserList request,
        CancellationToken cancellationToken)
    {
        var featureFlag = await _featureFlagService.GetAsync(request.EnvId, request.Filter.FeatureFlagKey);

        var param = new FeatureFlagEndUserParam
        {
            Query = request.Filter.Query,
            EnvId = request.EnvId,
            FlagExptId = $"{request.EnvId}-{request.Filter.FeatureFlagKey}",
            VariationId = request.Filter.VariationId,
            StartTime = request.Filter.From,
            EndTime = request.Filter.To,
            PageSize = request.Filter.PageSize,
            PageIndex = request.Filter.PageIndex
        };

        var stats = UseApiInsights()
            ? await _endUserStatsService.GetFeatureFlagEndUserStatsAsync(param)
            : await _olapService.GetFeatureFlagEndUserStats(param);

        var items = stats.Items
            .Select(it => new FeatureFlagEndUserStatsVm
            {
                Variation = featureFlag.Variations.FirstOrDefault(v => v.Id == it.VariationId)?.Name ?? it.VariationId,
                KeyId = it.KeyId,
                Name = it.Name,
                LastEvaluatedAt = it.LastEvaluatedAt
            }).ToList();

        return new PagedResult<FeatureFlagEndUserStatsVm>(stats.TotalCount, items);
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
