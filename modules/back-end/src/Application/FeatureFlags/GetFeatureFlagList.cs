using Application.Bases.Models;

namespace Application.FeatureFlags;

public class GetFeatureFlagList : IRequest<PagedResult<FeatureFlagVm>>
{
    public Guid EnvId { get; set; }

    public FeatureFlagFilter Filter { get; set; }
}

public class GetFeatureFlagListHandler(IFeatureFlagService service, IMapper mapper)
    : IRequestHandler<GetFeatureFlagList, PagedResult<FeatureFlagVm>>
{
    public async Task<PagedResult<FeatureFlagVm>> Handle(GetFeatureFlagList request, CancellationToken cancellationToken)
    {
        var flags = await service.GetListAsync(request.EnvId, request.Filter);
        return mapper.Map<PagedResult<FeatureFlagVm>>(flags);
    }
}