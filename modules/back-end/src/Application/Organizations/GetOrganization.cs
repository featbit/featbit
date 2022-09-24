using Application.Services;
using AutoMapper;
using Domain.Organizations;

namespace Application.Organizations;

public class GetOrganization : IRequest<OrganizationVm>
{
    public string Id { get; set; }
}

public class OrganizationVm
{
    public string Id { get; set; }

    public string Name { get; set; }

    public bool Initialized { get; set; }

    public Subscription Subscription { get; set; }
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

        return _mapper.Map<OrganizationVm>(organization);
    }
}