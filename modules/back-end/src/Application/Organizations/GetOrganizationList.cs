namespace Application.Organizations;

public class GetOrganizationList : IRequest<IEnumerable<OrganizationVm>>
{
    public Guid WorkspaceId { get; set; }

    public Guid UserId { get; set; }

}

public class GetOrganizationListHandler(IOrganizationService service, IMapper mapper,
    ISsoOrganizationJoinAuthorization authorization)
    : IRequestHandler<GetOrganizationList, IEnumerable<OrganizationVm>>
{
    public async Task<IEnumerable<OrganizationVm>> Handle(GetOrganizationList request,
        CancellationToken cancellationToken)
    {
        var organizations =
            await service.GetUserOrganizationsAsync(request.WorkspaceId, request.UserId);

        // Only server-side SSO authorization permits listing joinable organizations in this workspace.
        if (await authorization.CanChooseOrganizationAsync(request.WorkspaceId, request.UserId, organizations))
        {
            organizations = await service.FindManyAsync(x => x.WorkspaceId == request.WorkspaceId);
        }

        return mapper.Map<IEnumerable<OrganizationVm>>(organizations);
    }
}
