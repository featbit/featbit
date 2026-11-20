using Application.Policies;

namespace Application.Members;

public class GetMemberPolicy : IRequest<IEnumerable<PolicyVm>>
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }
}

public class GetMemberPolicyHandler : IRequestHandler<GetMemberPolicy, IEnumerable<PolicyVm>>
{
    private readonly IMemberService _service;

    public GetMemberPolicyHandler(IMemberService service)
    {
        _service = service;
    }

    public async ValueTask<IEnumerable<PolicyVm>> Handle(GetMemberPolicy request, CancellationToken cancellationToken)
    {
        var policies = await _service.GetPoliciesAsync(request.OrganizationId, request.MemberId);

        return PolicyMapper.ToVm(policies);
    }
}