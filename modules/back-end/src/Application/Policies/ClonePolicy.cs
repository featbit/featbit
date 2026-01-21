using Application.Bases;
using Application.Bases.Exceptions;

namespace Application.Policies;

public class ClonePolicy : IRequest<PolicyVm>
{
    public Guid OrgId { get; set; }

    public string OriginPolicyKey { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

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

        var policyToClone = await service.GetAsync(request.OrgId, request.OriginPolicyKey);

        var clonedPolicy = policyToClone.Clone(request.Name, request.Key, request.Description);
        await service.AddOneAsync(clonedPolicy);

        return mapper.Map<PolicyVm>(clonedPolicy);
    }
}