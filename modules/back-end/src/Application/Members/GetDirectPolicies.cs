using Application.Bases.Models;

namespace Application.Members;

public class GetDirectPolicies : IRequest<PagedResult<MemberPolicyVm>>
{
    public string OrganizationId { get; set; }

    public string MemberId { get; set; }

    public MemberPolicyFilter Filter { get; set; }
}

public class GetDirectPoliciesHandler : IRequestHandler<GetDirectPolicies, PagedResult<MemberPolicyVm>>
{
    private readonly IMemberService _service;

    public GetDirectPoliciesHandler(IMemberService service)
    {
        _service = service;
    }

    public async Task<PagedResult<MemberPolicyVm>> Handle(GetDirectPolicies request, CancellationToken cancellationToken)
    {
        var policies =
            await _service.GetDirectPoliciesAsync(request.OrganizationId, request.MemberId, request.Filter);

        return policies;
    }
}