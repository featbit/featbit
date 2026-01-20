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

public class ClonePolicyHandler(
    IPolicyService policyService,
    IMapper _mapper)
    : IRequestHandler<ClonePolicy, PolicyVm>
{
    public async Task<PolicyVm> Handle(ClonePolicy request, CancellationToken cancellationToken)
    {
        var hasKeyBeenUsed = await policyService.IsKeyUsedAsync(request.OrgId, request.Key);
        if (hasKeyBeenUsed)
        {
            throw new BusinessException(ErrorCodes.KeyHasBeenUsed);
        }

        var policyToClone = await policyService.GetAsync(request.OrgId, request.OriginPolicyKey);

        var clonedPolicy = policyToClone.Clone(request.Name, request.Key, request.Description);
        await policyService.AddOneAsync(clonedPolicy);

        return _mapper.Map<PolicyVm>(clonedPolicy);
    }
}