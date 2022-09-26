using Application.Bases.Models;

namespace Application.Groups;

public class GetGroupMember : IRequest<PagedResult<GroupMemberVm>>
{
    public string OrganizationId { get; set; }

    public string GroupId { get; set; }

    public GroupMemberFilter Filter { get; set; }
}

public class GetGroupMemberHandler : IRequestHandler<GetGroupMember, PagedResult<GroupMemberVm>>
{
    private readonly IGroupService _service;

    public GetGroupMemberHandler(IGroupService service)
    {
        _service = service;
    }

    public async Task<PagedResult<GroupMemberVm>> Handle(GetGroupMember request, CancellationToken cancellationToken)
    {
        var members =
            await _service.GetMembersAsync(request.OrganizationId, request.GroupId, request.Filter);

        return members;
    }
}