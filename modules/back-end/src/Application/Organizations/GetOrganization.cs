using Domain.Organizations;
using Domain.Policies;

namespace Application.Organizations;

public class GetOrganization : IRequest<OrganizationVm>
{
    public Guid Id { get; set; }
}

public class GetOrganizationHandler : IRequestHandler<GetOrganization, OrganizationVm>
{
    private readonly IOrganizationService _organizationService;
    private readonly IMapper _mapper;

    public GetOrganizationHandler(IOrganizationService organizationService, IMapper mapper)
    {
        _organizationService = organizationService;
        _mapper = mapper;
    }
    
    public async Task<OrganizationVm> Handle(GetOrganization request, CancellationToken cancellationToken)
    {
        var organization = await _organizationService.GetAsync(request.Id);
        organization.DefaultPermissions ??= new OrganizationPermissions
        {
            PolicyIds = new[] { BuiltInPolicy.Developer }
        };

        return _mapper.Map<OrganizationVm>(organization);
    }
}