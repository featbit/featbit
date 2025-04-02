using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Policies;

namespace Application.Policies;

public class UpdatePolicySetting : IRequest<PolicyVm>
{
    public Guid PolicyId { get; set; }

    public string Name { get; set; }

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