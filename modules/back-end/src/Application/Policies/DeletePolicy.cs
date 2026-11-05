using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;
namespace Application.Policies;

public class DeletePolicy : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }

    public Guid PolicyId { get; set; }
}

public class DeletePolicyHandler : IRequestHandler<DeletePolicy, bool>
{
    private readonly IPublisher _auditPublisher;
    private readonly ICurrentUser _auditActor;

    private readonly IPolicyService _service;

    public DeletePolicyHandler(IPolicyService service, IPublisher auditPublisher, ICurrentUser auditActor)
    {
        _auditPublisher = auditPublisher;
        _auditActor = auditActor;
        _service = service;
    }

    public async Task<bool> Handle(DeletePolicy request, CancellationToken cancellationToken)
    {
        var previous = await _service.GetAuditSnapshotAsync(request.PolicyId);
        var change = new DataChange(previous);

        await _service.DeleteAsync(request.PolicyId);

        await _auditPublisher.Publish(new OnIamResourceChanged(request.WorkspaceId, request.OrganizationId,
            AuditLogRefTypes.Policy, Operations.DeletePolicy, previous, change.To(null), _auditActor.Id), cancellationToken);

        return true;
    }
}