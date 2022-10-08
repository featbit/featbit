using Application.Bases.Models;

namespace Application.FeatureFlags;

public class GetFeatureFlagList : IRequest<PagedResult<FeatureFlagVm>>
{
    public Guid EnvId { get; set; }

    public FeatureFlagFilter Filter { get; set; }
}

public class GetFeatureFlagListHandler : IRequestHandler<GetFeatureFlagList, PagedResult<FeatureFlagVm>>
{
    private readonly IFeatureFlagService _service;
    private readonly IMapper _mapper;

    public GetFeatureFlagListHandler(IFeatureFlagService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<PagedResult<FeatureFlagVm>> Handle(GetFeatureFlagList request, CancellationToken cancellationToken)
    {
        var flags = await _service.GetListAsync(request.EnvId, request.Filter);
        return _mapper.Map<PagedResult<FeatureFlagVm>>(flags);
    }
}