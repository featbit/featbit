namespace Application.Organizations;

public class GetUserOrganization : IRequest<IEnumerable<OrganizationVm>>
{
    public string UserId { get; set; }
}

public class GetUserOrganizationHandler : IRequestHandler<GetUserOrganization, IEnumerable<OrganizationVm>>
{
    private readonly IOrganizationService _organizationService;
    private readonly IMapper _mapper;

    public GetUserOrganizationHandler(IOrganizationService organizationService, IMapper mapper)
    {
        _organizationService = organizationService;
        _mapper = mapper;
    }

    public async Task<IEnumerable<OrganizationVm>> Handle(GetUserOrganization request, CancellationToken cancellationToken)
    {
        var organizations = await _organizationService.GetUserOrganizationAsync(request.UserId);

        return _mapper.Map<IEnumerable<OrganizationVm>>(organizations);
    }
}