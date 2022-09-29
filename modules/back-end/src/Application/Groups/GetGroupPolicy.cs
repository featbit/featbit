using Application.Bases.Models;

namespace Application.Groups;

public class GetGroupPolicy : IRequest<PagedResult<GroupPolicyVm>>
{
    public Guid OrganizationId { get; set; }

    public Guid GroupId { get; set; }

    public GroupPolicyFilter Filter { get; set; }
}

public class GetGroupPolicyHandler : IRequestHandler<GetGroupPolicy, PagedResult<GroupPolicyVm>>
{
    private readonly IGroupService _service;

    public GetGroupPolicyHandler(IGroupService service)
    {
        _service = service;
    }

    public async Task<PagedResult<GroupPolicyVm>> Handle(GetGroupPolicy request, CancellationToken cancellationToken)
    {
        var policies =
            await _service.GetPoliciesAsync(request.OrganizationId, request.GroupId, request.Filter);

        return policies;
    }
}