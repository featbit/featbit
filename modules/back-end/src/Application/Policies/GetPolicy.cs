namespace Application.Policies;

public class GetPolicy : IRequest<PolicyVm>
{
    public Guid Id { get; set; }
}

public class GetPolicyHandler : IRequestHandler<GetPolicy, PolicyVm>
{
    private readonly IPolicyService _service;

    public GetPolicyHandler(IPolicyService service)
    {
        _service = service;
    }
    
    public async ValueTask<PolicyVm> Handle(GetPolicy request, CancellationToken cancellationToken)
    {
        var policy = await _service.GetAsync(request.Id);

        return PolicyMapper.ToVm(policy);
    }
}