namespace Application.Members;

public class RemoveFromWorkspace : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid MemberId { get; set; }
}

public class RemoveFromWorkspaceHandler(
    IUserService userService,
    IOrganizationService organizationService,
    IMemberService memberService)
    : IRequestHandler<RemoveFromWorkspace, bool>
{
    public async Task<bool> Handle(RemoveFromWorkspace request, CancellationToken cancellationToken)
    {
        // remove member from all organizations within the workspace
        var organizations = 
            await organizationService.GetUserOrganizationsAsync(request.WorkspaceId, request.MemberId);
        foreach (var organization in organizations)
        {
            await memberService.DeleteAsync(organization.Id, request.MemberId);
        }

        // remove member from workspace
        await userService.DeleteOneAsync(request.MemberId);

        return true;
    }
}