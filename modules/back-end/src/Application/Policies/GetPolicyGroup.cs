using Application.Bases.Models;

namespace Application.Policies;

public class GetPolicyGroup : IRequest<PagedResult<PolicyGroup>>
{
    public string OrganizationId { get; set; }

    public string PolicyId { get; set; }

    public PolicyGroupFilter Filter { get; set; }
}

public class GetPolicyGroupHandler : IRequestHandler<GetPolicyGroup, PagedResult<PolicyGroup>>
{
    private readonly IPolicyService _service;

    public GetPolicyGroupHandler(IPolicyService service)
    {
        _service = service;
    }

    public async Task<PagedResult<PolicyGroup>> Handle(GetPolicyGroup request, CancellationToken cancellationToken)
    {
        var groups =
            await _service.GetGroupsAsync(request.OrganizationId, request.PolicyId, request.Filter);

        return groups;
    }
}