using Application.Bases;
using Application.Bases.Models;
using Domain.FeatureFlags;

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
            .NotEmpty().WithErrorCode(ErrorCodes.FeatureFlagKeyIsRequired);

        RuleFor(x => x.Filter.From)
            .GreaterThan(0).WithErrorCode(ErrorCodes.StatsFromIsRequired);

        RuleFor(x => x.Filter.To)
            .GreaterThan(0).WithErrorCode(ErrorCodes.StatsToIsRequired);
    }
}

public class
    GetFeatureFlagEndUserListHandler : IRequestHandler<GetFeatureFlagEndUserList,
        PagedResult<FeatureFlagEndUserStatsVm>>
{
    private readonly IEndUserService _service;
    private readonly IFeatureFlagService _featureFlagService;
    private readonly IOlapService _olapService;

    public GetFeatureFlagEndUserListHandler(IEndUserService service, IFeatureFlagService featureFlagService,
        IOlapService olapService)
    {
        _service = service;
        _featureFlagService = featureFlagService;
        _olapService = olapService;
    }

    public async Task<PagedResult<FeatureFlagEndUserStatsVm>> Handle(GetFeatureFlagEndUserList request,
        CancellationToken cancellationToken)
    {
        var featureFlag = await _featureFlagService.GetAsync(request.EnvId, request.Filter.FeatureFlagKey);

        var param = new FeatureFlagEndUserParam
        {
            EnvId = request.EnvId,
            FlagExptId = $"{request.EnvId}-{request.Filter.FeatureFlagKey}",
            VariationId = request.Filter.VariationId,
            StartTime = request.Filter.From,
            EndTime = request.Filter.To,
            PageSize = request.Filter.PageSize,
            PageIndex = request.Filter.PageIndex
        };

        var stats = await _olapService.GetFeatureFlagEndUserStats(param);
        
        var items = stats.Items
            .Select(it => new FeatureFlagEndUserStatsVm
            {
                Variation = featureFlag.Variations.FirstOrDefault(v => v.Id == it.VariationId)?.Value ?? it.VariationId,
                KeyId = it.KeyId,
                Name = it.Name,
                LastEvaluatedAt = it.LastEvaluatedAt
            }).ToList();
        
        return new PagedResult<FeatureFlagEndUserStatsVm>(stats.TotalCount, items);
    }
}