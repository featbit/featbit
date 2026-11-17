using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;
namespace Application.Groups;

public class DeleteGroup : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }

    public Guid Id { get; set; }
}

public class DeleteGroupHandler : IRequestHandler<DeleteGroup, bool>
{
    private readonly IPublisher _auditPublisher;
    private readonly ICurrentUser _auditActor;

    private readonly IGroupService _service;

    public DeleteGroupHandler(IGroupService service, IPublisher auditPublisher, ICurrentUser auditActor)
    {
        _auditPublisher = auditPublisher;
        _auditActor = auditActor;
        _service = service;
    }
    
    public async Task<bool> Handle(DeleteGroup request, CancellationToken cancellationToken)
    {
        var previous = await _service.GetAuditSnapshotAsync(request.Id);
        var change = new DataChange(previous);

        await _service.DeleteAsync(request.Id);

        await _auditPublisher.Publish(new OnIamResourceChanged(request.WorkspaceId, request.OrganizationId,
            AuditLogRefTypes.Group, Operations.DeleteGroup, previous, change.To(null), _auditActor.Id), cancellationToken);

        return true;
    }
}
