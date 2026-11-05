using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;
namespace Application.Members;

public class RemoveMemberPolicy : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }

    public Guid PolicyId { get; set; }
}

public class RemoveMemberPolicyHandler : IRequestHandler<RemoveMemberPolicy, bool>
{
    private readonly IPublisher _auditPublisher;
    private readonly ICurrentUser _auditActor;

    private readonly IMemberService _service;

    public RemoveMemberPolicyHandler(IMemberService service, IPublisher auditPublisher, ICurrentUser auditActor)
    {
        _auditPublisher = auditPublisher;
        _auditActor = auditActor;
        _service = service;
    }

    public async Task<bool> Handle(RemoveMemberPolicy request, CancellationToken cancellationToken)
    {
        var previous = await _service.GetAuditSnapshotAsync(request.MemberId, request.OrganizationId, request.WorkspaceId);
        var change = new DataChange(previous);

        await _service.RemovePolicyAsync(request.OrganizationId, request.MemberId, request.PolicyId);

        var current = await _service.GetAuditSnapshotAsync(request.MemberId, request.OrganizationId, request.WorkspaceId);
        await _auditPublisher.Publish(new OnIamResourceChanged(request.WorkspaceId, request.OrganizationId,
            AuditLogRefTypes.Member, Operations.RemoveMemberPolicy, current ?? previous, change.To(current), _auditActor.Id), cancellationToken);

        return true;
    }
}