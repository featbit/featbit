using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;

namespace Application.Members;

public class RemoveFromOrganization : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }
}

public class RemoveFromOrganizationHandler(
    IOrganizationService organizationService,
    IMemberService memberService,
    ISender mediator, IPublisher publisher, ICurrentUser currentUser) : IRequestHandler<RemoveFromOrganization, bool>
{
    public async Task<bool> Handle(RemoveFromOrganization request, CancellationToken cancellationToken)
    {
        var previous = await memberService.GetAuditSnapshotAsync(request.MemberId, request.OrganizationId, request.WorkspaceId);
        var change = new DataChange(previous);
        await memberService.DeleteAsync(request.OrganizationId, request.MemberId);

        await publisher.Publish(new OnIamResourceChanged(request.WorkspaceId, request.OrganizationId,
            AuditLogRefTypes.Member, Operations.RemoveFromOrganization, previous, change.To(null), currentUser.Id), cancellationToken);

        var organizations = 
            await organizationService.GetUserOrganizationsAsync(request.WorkspaceId, request.MemberId);
        if (organizations.Count == 0)
        {
            await mediator.Send(new RemoveFromWorkspace
            {
                WorkspaceId = request.WorkspaceId,
                MemberId = request.MemberId
            }, cancellationToken);
        }

        return true;
    }
}