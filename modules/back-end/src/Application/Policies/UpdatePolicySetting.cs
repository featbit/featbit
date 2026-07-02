using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Policies;

namespace Application.Policies;

public class UpdatePolicySetting : IRequest<PolicyVm>
{
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
    private readonly IPolicyService _service;
    private readonly IMapper _mapper;

    public UpdatePolicySettingHandler(IPolicyService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<PolicyVm> Handle(UpdatePolicySetting request, CancellationToken cancellationToken)
    {
        var policy = await _service.GetAsync(request.PolicyId);
        if (policy.Type == PolicyTypes.SysManaged)
        {
            throw new BusinessException(ErrorCodes.CannotModifySysManagedPolicy);
        }

        policy.UpdateSetting(request.Name, request.Description);

        await _service.UpdateAsync(policy);

        return _mapper.Map<PolicyVm>(policy);
    }
}