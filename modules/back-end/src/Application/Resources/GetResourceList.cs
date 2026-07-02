using Domain.Resources;

namespace Application.Resources;

public class GetResourceList : IRequest<IEnumerable<Resource>>
{
    public Guid OrganizationId { get; set; }

    public ResourceFilter Filter { get; set; }
}

public class GetResourceListHandler(IResourceService service) : IRequestHandler<GetResourceList, IEnumerable<Resource>>
{
    public async Task<IEnumerable<Resource>> Handle(GetResourceList request, CancellationToken cancellationToken)
    {
        var resources = await service.GetResourcesAsync(request.OrganizationId, request.Filter);
        return resources;
    }
}