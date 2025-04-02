using Application.Bases;
using Domain.Policies;

namespace Application.Policies;

public class CreatePolicy : IRequest<PolicyVm>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }
}

public class CreatePolicyValidator : AbstractValidator<CreatePolicy>
{
    public CreatePolicyValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class CreatePolicyHandler : IRequestHandler<CreatePolicy, PolicyVm>
{
    private readonly IPolicyService _service;
    private readonly IMapper _mapper;

    public CreatePolicyHandler(IPolicyService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<PolicyVm> Handle(CreatePolicy request, CancellationToken cancellationToken)
    {
        var policy = new Policy(request.OrganizationId, request.Name, request.Description);

        await _service.AddOneAsync(policy);

        return _mapper.Map<PolicyVm>(policy);
    }
}