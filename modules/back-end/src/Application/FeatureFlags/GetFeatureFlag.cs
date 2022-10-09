using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class GetFeatureFlag : IRequest<FeatureFlag>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }
}

public class GetFeatureFlagHandler : IRequestHandler<GetFeatureFlag, FeatureFlag>
{
    private readonly IFeatureFlagService _service;

    public GetFeatureFlagHandler(IFeatureFlagService service)
    {
        _service = service;
    }
    
    public async Task<FeatureFlag> Handle(GetFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        return flag;
    }
}

