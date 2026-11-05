using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;
using Domain.Members;

namespace Application.Members;

public class AddMemberPolicy : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }

    public Guid PolicyId { get; set; }
}

public class AddMemberPolicyHandler : IRequestHandler<AddMemberPolicy, bool>
{
    private readonly IPublisher _auditPublisher;
    private readonly ICurrentUser _auditActor;

    private readonly IMemberService _service;

    public AddMemberPolicyHandler(IMemberService service, IPublisher auditPublisher, ICurrentUser auditActor)
    {
        _auditPublisher = auditPublisher;
        _auditActor = auditActor;
        _service = service;
    }
    
    public async Task<bool> Handle(AddMemberPolicy request, CancellationToken cancellationToken)
    {
        var previous = await _service.GetAuditSnapshotAsync(request.MemberId, request.OrganizationId, request.WorkspaceId);
        var change = new DataChange(previous);

        var policy = new MemberPolicy(request.OrganizationId, request.MemberId, request.PolicyId);

        await _service.AddPolicyAsync(policy);

        var current = await _service.GetAuditSnapshotAsync(request.MemberId, request.OrganizationId, request.WorkspaceId);
        await _auditPublisher.Publish(new OnIamResourceChanged(request.WorkspaceId, request.OrganizationId,
            AuditLogRefTypes.Member, Operations.AddMemberPolicy, current ?? previous, change.To(current), _auditActor.Id), cancellationToken);

        return true;
    }
}