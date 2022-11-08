namespace Application.FeatureFlags;

public class GetAllTag : IRequest<ICollection<string>>
{
    public Guid EnvId { get; set; }
}

public class GetAllTagHandler : IRequestHandler<GetAllTag, ICollection<string>>
{
    private readonly IFeatureFlagService _service;

    public GetAllTagHandler(IFeatureFlagService service)
    {
        _service = service;
    }

    public async Task<ICollection<string>> Handle(GetAllTag request, CancellationToken cancellationToken)
    {
        return await _service.GetAllTagsAsync(request.EnvId);
    }
}