using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Policies;

namespace Application.Policies;

public class UpdatePolicyStatements : IRequest<PolicyVm>
{
    public Guid PolicyId { get; set; }

    public ICollection<PolicyStatement> Statements { get; set; }
}

public class UpdatePolicyStatementsHandler : IRequestHandler<UpdatePolicyStatements, PolicyVm>
{
    private readonly IPolicyService _service;
    private readonly IMapper _mapper;

    public UpdatePolicyStatementsHandler(IPolicyService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }
    
    public async Task<PolicyVm> Handle(UpdatePolicyStatements request, CancellationToken cancellationToken)
    {
        var policy = await _service.GetAsync(request.PolicyId);
        if (policy.Type == PolicyTypes.SysManaged)
        {
            throw new BusinessException(ErrorCodes.CannotModifySysManagedPolicy);
        }

        policy.UpdateStatements(request.Statements);

        await _service.UpdateAsync(policy);

        return _mapper.Map<PolicyVm>(policy);
    }
}