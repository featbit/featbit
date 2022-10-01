using Application.Bases;
using Application.Organizations;
using Application.Users;
using Domain.Projects;

namespace Application.Resources;

public class GetResourceList : IRequest<IEnumerable<ResourceVm>>
{
    public Guid OrganizationId { get; set; }

    public ResourceFilter Filter { get; set; }
}

public class GetResourceListValidator : AbstractValidator<GetResourceList>
{
    public GetResourceListValidator()
    {
        RuleFor(x => x.Filter.Type)
            .NotEmpty().WithErrorCode(ErrorCodes.TypeIsRequired);
    }
}

public class GetResourceListHandler : IRequestHandler<GetResourceList, IEnumerable<ResourceVm>>
{
    private readonly IResourceService _resourceService;
    private readonly IMapper _mapper;
    
    public GetResourceListHandler(
        IResourceService resourceService,
        IMapper mapper)
    {
        _resourceService = resourceService;
        _mapper = mapper;
    }

    public async Task<IEnumerable<ResourceVm>> Handle(GetResourceList request, CancellationToken cancellationToken)
    {
        var resources = await _resourceService.GetResourcesAsync(request.OrganizationId, request.Filter.Type, request.Filter.Name);
        return _mapper.Map<IEnumerable<ResourceVm>>(resources);
    }
}