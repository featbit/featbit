namespace Application.Segments;

public class GetAllTag : IRequest<ICollection<string>>
{
    public Guid WorkspaceId { get; set; }
    public Guid EnvId { get; set; }
}

public class GetAllTagHandler : IRequestHandler<GetAllTag, ICollection<string>>
{
    private readonly IEnvironmentAppService _service;

    public GetAllTagHandler(IEnvironmentAppService service)
    {
        _service = service;
    }

    public async Task<ICollection<string>> Handle(GetAllTag request, CancellationToken cancellationToken)
    { 
        return await _service.GetSegmentAllTagsAsync(request);
    }
}