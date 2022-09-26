namespace Application.Policies;

public class GetPolicy : IRequest<PolicyVm>
{
    public string Id { get; set; }
}

public class GetPolicyHandler : IRequestHandler<GetPolicy, PolicyVm>
{
    private readonly IPolicyService _service;
    private readonly IMapper _mapper;

    public GetPolicyHandler(IPolicyService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }
    
    public async Task<PolicyVm> Handle(GetPolicy request, CancellationToken cancellationToken)
    {
        var policy = await _service.GetAsync(request.Id);

        return _mapper.Map<PolicyVm>(policy);
    }
}