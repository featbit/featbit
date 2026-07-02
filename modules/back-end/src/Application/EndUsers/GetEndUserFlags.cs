using Application.Bases.Models;
using Application.FeatureFlags;

namespace Application.EndUsers;

public class GetEndUserFlags : PagedRequest, IRequest<PagedResult<EndUserFlagVm>>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public FeatureFlagFilter Filter { get; set; }
}

public class GetEndUserFlagsHandler(
    IFeatureFlagService flagService,
    IEndUserService endUserService,
    IEvaluator evaluator)
    : IRequestHandler<GetEndUserFlags, PagedResult<EndUserFlagVm>>
{
    public async Task<PagedResult<EndUserFlagVm>> Handle(GetEndUserFlags request, CancellationToken cancellationToken)
    {
        var endUser = await endUserService.GetAsync(request.Id);
        var flags = await flagService.GetListAsync(request.EnvId, request.Filter);

        var vms = new List<EndUserFlagVm>();
        foreach (var flag in flags.Items)
        {
            var variation = await evaluator.EvaluateAsync(flag, endUser);
            vms.Add(new EndUserFlagVm(flag, variation));
        }

        var result = new PagedResult<EndUserFlagVm>(flags.TotalCount, vms);
        return result;
    }
}