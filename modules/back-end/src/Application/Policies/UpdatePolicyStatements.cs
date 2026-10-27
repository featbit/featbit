using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;
using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Policies;

namespace Application.Policies;

public class UpdatePolicyStatements : IRequest<PolicyVm>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }

    public Guid PolicyId { get; set; }

    public ICollection<PolicyStatement> Statements { get; set; }
}

public class UpdatePolicyStatementsHandler : IRequestHandler<UpdatePolicyStatements, PolicyVm>
{
    private readonly IPublisher _auditPublisher;
    private readonly ICurrentUser _auditActor;

    private readonly IPolicyService _service;
    private readonly IMapper _mapper;

    public UpdatePolicyStatementsHandler(IPolicyService service, IMapper mapper, IPublisher auditPublisher, ICurrentUser auditActor)
    {
        _auditPublisher = auditPublisher;
        _auditActor = auditActor;
        _service = service;
        _mapper = mapper;
    }
    
    public async Task<PolicyVm> Handle(UpdatePolicyStatements request, CancellationToken cancellationToken)
    {
        var previous = await _service.GetAuditSnapshotAsync(request.PolicyId);
        var change = new DataChange(previous);

        var policy = await _service.GetAsync(request.PolicyId);
        if (policy.Type == PolicyTypes.SysManaged)
        {
            throw new BusinessException(ErrorCodes.CannotModifySysManagedPolicy);
        }

        policy.UpdateStatements(request.Statements);

        await _service.UpdateAsync(policy);

        var current = await _service.GetAuditSnapshotAsync(request.PolicyId);
        await _auditPublisher.Publish(new OnIamResourceChanged(request.WorkspaceId, request.OrganizationId,
            AuditLogRefTypes.Policy, Operations.UpdatePolicyStatements, current ?? previous, change.To(current), _auditActor.Id), cancellationToken);

        return _mapper.Map<PolicyVm>(policy);
    }
}