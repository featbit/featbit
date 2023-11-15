namespace Application.Organizations;

public class GetOrganizationList : IRequest<IEnumerable<OrganizationVm>>
{
    public Guid WorkspaceId { get; set; }

    public Guid UserId { get; set; }

    public bool IsSsoInitial { get; set; }
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
        if (!organizations.Any() && request.IsSsoInitial)
        {
            organizations = await _service.FindManyAsync(x => x.WorkspaceId == request.WorkspaceId);
        }

        return _mapper.Map<IEnumerable<OrganizationVm>>(organizations);
    }
}