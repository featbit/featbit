using Domain.Resources;

namespace Application.Resources;

public class GetResourceList : IRequest<IEnumerable<Resource>>
{
    public Guid OrganizationId { get; set; }

    public ResourceFilter Filter { get; set; }
}

public class GetResourceListHandler : IRequestHandler<GetResourceList, IEnumerable<Resource>>
{
    private readonly IResourceService _service;
    private readonly IMapper _mapper;

    public GetResourceListHandler(IResourceService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<IEnumerable<Resource>> Handle(GetResourceList request, CancellationToken cancellationToken)
    {
        var resources = await _service.GetResourcesAsync(request.OrganizationId, request.Filter);

        return _mapper.Map<IEnumerable<Resource>>(resources);
    }
}