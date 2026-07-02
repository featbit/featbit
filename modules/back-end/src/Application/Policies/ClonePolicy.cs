using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Policies;

namespace Application.Policies;

public class ClonePolicy : IRequest<PolicyVm>
{
    /// <summary>
    /// The ID of the organization the policy belongs to. Retrieved from the request header.
    /// </summary>
    public Guid OrgId { get; set; }

    /// <summary>
    /// The key of the policy from which the policy is cloned. Retrieved from the URL path.
    /// </summary>
    public string OriginPolicyKey { get; set; }

    /// <summary>
    /// The type of the policy from which the policy is cloned. Should be either "CustomerManaged" or "SysManaged".
    /// </summary>
    public string OriginPolicyType { get; set; }

    /// <summary>
    /// The name of the cloned policy.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The unique key of the cloned policy.
    /// </summary>
    public string Key { get; set; }

    /// <summary>
    /// The description of the cloned policy.
    /// </summary>
    public string Description { get; set; }
}

public class ClonePolicyValidator : AbstractValidator<ClonePolicy>
{
    public ClonePolicyValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"));

        RuleFor(x => x.OriginPolicyType)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("originPolicyType"))
            .Must(x => PolicyTypes.All.Contains(x)).WithErrorCode(ErrorCodes.Invalid("originPolicyType"));
    }
}

public class ClonePolicyHandler(IPolicyService service, IMapper mapper)
    : IRequestHandler<ClonePolicy, PolicyVm>
{
    public async Task<PolicyVm> Handle(ClonePolicy request, CancellationToken cancellationToken)
    {
        var hasKeyBeenUsed = await service.IsKeyUsedAsync(request.OrgId, request.Key);
        if (hasKeyBeenUsed)
        {
            throw new BusinessException(ErrorCodes.KeyHasBeenUsed);
        }

        Guid? organizationId = request.OriginPolicyType == PolicyTypes.CustomerManaged ? request.OrgId : null;
        var policyToClone =
            await service.FindOneAsync(x => x.OrganizationId == organizationId && x.Key == request.OriginPolicyKey);

        if (policyToClone == null)
        {
            throw new EntityNotFoundException(
                nameof(Policy),
                $"{request.OrgId}.{request.OriginPolicyType}.{request.OriginPolicyKey}"
            );
        }

        var clonedPolicy = policyToClone.Clone(request.OrgId, request.Name, request.Key, request.Description);
        await service.AddOneAsync(clonedPolicy);

        return mapper.Map<PolicyVm>(clonedPolicy);
    }
}