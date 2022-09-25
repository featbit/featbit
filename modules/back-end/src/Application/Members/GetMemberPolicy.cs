using Application.Policies;

namespace Application.Members;

public class GetMemberPolicy : IRequest<IEnumerable<PolicyVm>>
{
    public string OrganizationId { get; set; }

    public string MemberId { get; set; }
}

public class GetMemberPolicyHandler : IRequestHandler<GetMemberPolicy, IEnumerable<PolicyVm>>
{
    private readonly IMemberService _service;
    private readonly IMapper _mapper;

    public GetMemberPolicyHandler(IMemberService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }
    
    public async Task<IEnumerable<PolicyVm>> Handle(GetMemberPolicy request, CancellationToken cancellationToken)
    {
        var policies = await _service.GetPoliciesAsync(request.OrganizationId, request.MemberId);

        return _mapper.Map<IEnumerable<PolicyVm>>(policies);
    }
}