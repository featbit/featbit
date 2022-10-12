namespace Application.FeatureFlags;

public class IsFeatureFlagKeyUsed : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }
}

public class IsFeatureFlagKeyUsedHandler : IRequestHandler<IsFeatureFlagKeyUsed, bool>
{
    private readonly IFeatureFlagService _service;

    public IsFeatureFlagKeyUsedHandler(IFeatureFlagService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(IsFeatureFlagKeyUsed request, CancellationToken cancellationToken)
    {
        return await _service.AnyAsync(x => x.EnvId == request.EnvId && x.Key == request.Key);
    }
}