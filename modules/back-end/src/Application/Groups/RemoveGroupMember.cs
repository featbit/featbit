using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;
namespace Application.Groups;

public class RemoveGroupMember : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }

    public Guid GroupId { get; set; }

    public Guid MemberId { get; set; }
}

public class RemoveGroupMemberHandler : IRequestHandler<RemoveGroupMember, bool>
{
    private readonly IPublisher _auditPublisher;
    private readonly ICurrentUser _auditActor;

    private readonly IGroupService _service;

    public RemoveGroupMemberHandler(IGroupService service, IPublisher auditPublisher, ICurrentUser auditActor)
    {
        _auditPublisher = auditPublisher;
        _auditActor = auditActor;
        _service = service;
    }
    
    public async Task<bool> Handle(RemoveGroupMember request, CancellationToken cancellationToken)
    {
        var previous = await _service.GetAuditSnapshotAsync(request.GroupId);
        var change = new DataChange(previous);

        await _service.RemoveMemberAsync(request.GroupId, request.MemberId);

        var current = await _service.GetAuditSnapshotAsync(request.GroupId);
        await _auditPublisher.Publish(new OnIamResourceChanged(request.WorkspaceId, request.OrganizationId,
            AuditLogRefTypes.Group, Operations.RemoveGroupMember, current ?? previous, change.To(current), _auditActor.Id), cancellationToken);

        return true;
    }
}