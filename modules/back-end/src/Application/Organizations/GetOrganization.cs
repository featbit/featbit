namespace Application.Organizations;

public class GetOrganization : IRequest<OrganizationVm>
{
    public Guid Id { get; set; }
}

public class GetOrganizationHandler : IRequestHandler<GetOrganization, OrganizationVm>
{
    private readonly IOrganizationService _organizationService;

    public GetOrganizationHandler(IOrganizationService organizationService)
    {
        _organizationService = organizationService;
    }

    public async ValueTask<OrganizationVm> Handle(GetOrganization request, CancellationToken cancellationToken)
    {
        var organization = await _organizationService.GetAsync(request.Id);
        return OrganizationMapper.ToVm(organization);
    }
}