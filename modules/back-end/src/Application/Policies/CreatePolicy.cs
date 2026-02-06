using Application.Bases;
using Domain.Policies;

namespace Application.Policies;

public class CreatePolicy : IRequest<PolicyVm>
{
    /// <summary>
    /// The ID of the organization the policy belongs to. Retrieved from the request header.
    /// </summary>
    public Guid OrganizationId { get; set; }

    /// <summary>
    /// The name of the policy.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The unique key of the policy.
    /// </summary>
    public string Key { get; set; }

    /// <summary>
    /// The description of the policy.
    /// </summary>
    public string Description { get; set; }
}

public class CreatePolicyValidator : AbstractValidator<CreatePolicy>
{
    public CreatePolicyValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"));
    }
}

public class CreatePolicyHandler(IPolicyService service, IMapper mapper) : IRequestHandler<CreatePolicy, PolicyVm>
{
    public async Task<PolicyVm> Handle(CreatePolicy request, CancellationToken cancellationToken)
    {
        var policy = new Policy(request.OrganizationId, request.Name, request.Key, request.Description);

        await service.AddOneAsync(policy);

        return mapper.Map<PolicyVm>(policy);
    }
}