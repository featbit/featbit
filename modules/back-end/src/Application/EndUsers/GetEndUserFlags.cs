using Application.Bases.Models;
using Application.FeatureFlags;

namespace Application.EndUsers;

public class GetEndUserFlags : PagedRequest, IRequest<PagedResult<EndUserFlagVm>>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public string SearchText { get; set; }

    public FeatureFlagFilter Filter()
    {
        var filter = new FeatureFlagFilter
        {
            Name = SearchText,
            IsArchived = false,
            PageIndex = PageIndex,
            PageSize = PageSize
        };

        return filter;
    }
}

public class GetEndUserFlagsHandler : IRequestHandler<GetEndUserFlags, PagedResult<EndUserFlagVm>>
{
    private readonly IFeatureFlagService _flagService;
    private readonly IEndUserService _endUserService;
    private readonly IEvaluator _evaluator;

    public GetEndUserFlagsHandler(
        IFeatureFlagService flagService,
        IEndUserService endUserService,
        IEvaluator evaluator)
    {
        _flagService = flagService;
        _endUserService = endUserService;
        _evaluator = evaluator;
    }

    public async Task<PagedResult<EndUserFlagVm>> Handle(GetEndUserFlags request, CancellationToken cancellationToken)
    {
        var endUser = await _endUserService.GetAsync(request.Id);
        var flags = await _flagService.GetListAsync(request.EnvId, request.Filter());

        var vms = new List<EndUserFlagVm>();
        foreach (var flag in flags.Items)
        {
            var variation = await _evaluator.EvaluateAsync(flag, endUser);
            vms.Add(new EndUserFlagVm(flag, variation));
        }

        var result = new PagedResult<EndUserFlagVm>(flags.TotalCount, vms);
        return result;
    }
}