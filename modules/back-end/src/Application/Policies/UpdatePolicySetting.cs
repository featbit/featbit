using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;
using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Policies;

namespace Application.Policies;

public class UpdatePolicySetting : IRequest<PolicyVm>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }

    /// <summary>
    /// The ID of the policy to update. Retrieved from the URL path.
    /// </summary>
    public Guid PolicyId { get; set; }

    /// <summary>
    /// The new name for the policy.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The new description for the policy.
    /// </summary>
    public string Description { get; set; }
}

public class UpdatePolicySettingValidator : AbstractValidator<UpdatePolicySetting>
{
    public UpdatePolicySettingValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class UpdatePolicySettingHandler : IRequestHandler<UpdatePolicySetting, PolicyVm>
{
    private readonly IPublisher _auditPublisher;
    private readonly ICurrentUser _auditActor;

    private readonly IPolicyService _service;
    private readonly IMapper _mapper;

    public UpdatePolicySettingHandler(IPolicyService service, IMapper mapper, IPublisher auditPublisher, ICurrentUser auditActor)
    {
        _auditPublisher = auditPublisher;
        _auditActor = auditActor;
        _service = service;
        _mapper = mapper;
    }

    public async Task<PolicyVm> Handle(UpdatePolicySetting request, CancellationToken cancellationToken)
    {
        var previous = await _service.GetAuditSnapshotAsync(request.PolicyId);
        var change = new DataChange(previous);

        var policy = await _service.GetAsync(request.PolicyId);
        if (policy.Type == PolicyTypes.SysManaged)
        {
            throw new BusinessException(ErrorCodes.CannotModifySysManagedPolicy);
        }

        policy.UpdateSetting(request.Name, request.Description);

        await _service.UpdateAsync(policy);

        var current = await _service.GetAuditSnapshotAsync(request.PolicyId);
        await _auditPublisher.Publish(new OnIamResourceChanged(request.WorkspaceId, request.OrganizationId,
            AuditLogRefTypes.Policy, Operations.UpdatePolicySetting, current ?? previous, change.To(current), _auditActor.Id), cancellationToken);

        return _mapper.Map<PolicyVm>(policy);
    }
}