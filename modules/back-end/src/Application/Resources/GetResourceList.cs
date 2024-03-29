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

    public GetResourceListHandler(IResourceService service)
    {
        _service = service;
    }

    public async Task<IEnumerable<Resource>> Handle(GetResourceList request, CancellationToken cancellationToken)
    {
        var resources = await _service.GetResourcesAsync(request.OrganizationId, request.Filter);
        return resources;
    }
}