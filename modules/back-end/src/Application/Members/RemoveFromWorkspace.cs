using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;

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
    IMemberService memberService, IPublisher publisher, ICurrentUser currentUser)
    : IRequestHandler<RemoveFromWorkspace, bool>
{
    public async Task<bool> Handle(RemoveFromWorkspace request, CancellationToken cancellationToken)
    {
        var workspaceSnapshot = await memberService.GetAuditSnapshotAsync(request.MemberId, null, request.WorkspaceId);
        var workspaceChange = new DataChange(workspaceSnapshot);

        // remove member from all organizations within the workspace
        var organizations =
            await organizationService.GetUserOrganizationsAsync(request.WorkspaceId, request.MemberId);
        foreach (var organization in organizations)
        {
            var previous = await memberService.GetAuditSnapshotAsync(request.MemberId, organization.Id, request.WorkspaceId);
            var change = new DataChange(previous);
            await memberService.DeleteAsync(organization.Id, request.MemberId);
            await publisher.Publish(new OnIamResourceChanged(request.WorkspaceId, organization.Id,
                AuditLogRefTypes.Member, Operations.RemoveFromWorkspace, previous, change.To(null), currentUser.Id), cancellationToken);
        }

        // remove member from the workspace
        await workspaceService.RemoveUserAsync(request.WorkspaceId, request.MemberId);

        // remove user if he does not belong to any workspace 
        var workspaces = await userService.GetWorkspacesAsync(request.MemberId);
        if (workspaces.Count == 0)
        {
            await userService.DeleteOneAsync(request.MemberId);
        }

        await publisher.Publish(new OnIamResourceChanged(request.WorkspaceId, null,
            AuditLogRefTypes.Member, Operations.RemoveFromWorkspace, workspaceSnapshot, workspaceChange.To(null), currentUser.Id), cancellationToken);
        return true;
    }
}