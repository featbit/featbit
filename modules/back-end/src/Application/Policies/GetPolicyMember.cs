using Application.Bases.Models;

namespace Application.Policies;

public class GetPolicyMember : IRequest<PagedResult<PolicyMember>>
{
    public string OrganizationId { get; set; }

    public string PolicyId { get; set; }

    public PolicyMemberFilter Filter { get; set; }
}

public class GetPolicyMemberHandler : IRequestHandler<GetPolicyMember, PagedResult<PolicyMember>>
{
    private readonly IPolicyService _service;

    public GetPolicyMemberHandler(IPolicyService service)
    {
        _service = service;
    }
    
    public async Task<PagedResult<PolicyMember>> Handle(GetPolicyMember request, CancellationToken cancellationToken)
    {
        var members = await _service.GetMembersAsync(request.OrganizationId, request.PolicyId, request.Filter);
        return members;
    }
}