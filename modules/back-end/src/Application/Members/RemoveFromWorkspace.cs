namespace Application.Members;

public class RemoveFromWorkspace : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid MemberId { get; set; }
}

public class RemoveFromWorkspaceHandler(
    IWorkspaceService workspaceService,
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
        
        // remove member from the workspace
        await workspaceService.RemoveUserAsync(request.WorkspaceId, request.MemberId);

        // remove member from workspace
        var workspaces = await userService.GetWorkspacesAsync(request.MemberId);
        if (workspaces.Count == 0)
        {
            await userService.DeleteOneAsync(request.MemberId);
        }

        return true;
    }
}