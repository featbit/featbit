using Application.Bases.Models;

namespace Application.Members;

public class GetInheritedPolicies : IRequest<PagedResult<InheritedMemberPolicy>>
{
    public string OrganizationId { get; set; }

    public string MemberId { get; set; }

    public InheritedMemberPolicyFilter Filter { get; set; }
}

public class GetInheritedPoliciesHandler : IRequestHandler<GetInheritedPolicies, PagedResult<InheritedMemberPolicy>>
{
    private readonly IMemberService _service;

    public GetInheritedPoliciesHandler(IMemberService service)
    {
        _service = service;
    }

    public async Task<PagedResult<InheritedMemberPolicy>> Handle(GetInheritedPolicies request, CancellationToken cancellationToken)
    {
        var policies =
            await _service.GetInheritedPoliciesAsync(request.OrganizationId, request.MemberId, request.Filter);

        return policies;
    }
}