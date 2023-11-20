namespace Application.Organizations;

public class GetOrganizationList : IRequest<IEnumerable<OrganizationVm>>
{
    public Guid WorkspaceId { get; set; }

    public Guid UserId { get; set; }

    public bool IsSsoFirstLogin { get; set; }
}

public class GetOrganizationListHandler : IRequestHandler<GetOrganizationList, IEnumerable<OrganizationVm>>
{
    private readonly IOrganizationService _service;
    private readonly IMapper _mapper;

    public GetOrganizationListHandler(IOrganizationService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<IEnumerable<OrganizationVm>> Handle(GetOrganizationList request, CancellationToken cancellationToken)
    {
        var organizations = await _service.GetListAsync(request.UserId);

        // If the user is logging in for the first time via Single Sign-On (SSO) and they are not part of any organization yet,
        // retrieve and return all organizations within the same workspace.
        if (!organizations.Any() && request.IsSsoFirstLogin)
        {
            organizations = await _service.FindManyAsync(x => x.WorkspaceId == request.WorkspaceId);
        }

        return _mapper.Map<IEnumerable<OrganizationVm>>(organizations);
    }
}