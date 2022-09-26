namespace Application.Organizations;

public class GetOrganizationList : IRequest<IEnumerable<OrganizationVm>>
{
    public string UserId { get; set; }
}

public class GetOrganizationListHandler : IRequestHandler<GetOrganizationList, IEnumerable<OrganizationVm>>
{
    private readonly IOrganizationService _organizationService;
    private readonly IMapper _mapper;

    public GetOrganizationListHandler(IOrganizationService organizationService, IMapper mapper)
    {
        _organizationService = organizationService;
        _mapper = mapper;
    }

    public async Task<IEnumerable<OrganizationVm>> Handle(GetOrganizationList request, CancellationToken cancellationToken)
    {
        var organizations = await _organizationService.GetUserOrganizationAsync(request.UserId);

        return _mapper.Map<IEnumerable<OrganizationVm>>(organizations);
    }
}