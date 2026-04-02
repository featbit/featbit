namespace Application.Organizations;

public class GetOrganizationList : IRequest<IEnumerable<OrganizationVm>>
{
    public Guid WorkspaceId { get; set; }

    public Guid UserId { get; set; }

    public bool IsSsoFirstLogin { get; set; }
}

public class GetOrganizationListHandler(IOrganizationService service, IMapper mapper)
    : IRequestHandler<GetOrganizationList, IEnumerable<OrganizationVm>>
{
    public async Task<IEnumerable<OrganizationVm>> Handle(GetOrganizationList request,
        CancellationToken cancellationToken)
    {
        var organizations =
            await service.GetUserOrganizationsAsync(request.WorkspaceId, request.UserId);

        // If the user is logging in for the first time via Single Sign-On (SSO) and they are not part of any organization yet,
        // retrieve and return all organizations within the same workspace.
        if (organizations.Count == 0 && request.IsSsoFirstLogin)
        {
            organizations = await service.FindManyAsync(x => x.WorkspaceId == request.WorkspaceId);
        }

        return mapper.Map<IEnumerable<OrganizationVm>>(organizations);
    }
}