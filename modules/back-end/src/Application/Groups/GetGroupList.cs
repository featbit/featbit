using Application.Bases.Models;

namespace Application.Groups;

public class GetGroupList : IRequest<PagedResult<GroupVm>>
{
    public Guid OrganizationId { get; set; }

    public GroupFilter Filter { get; set; }
}

public class GetGroupListHandler : IRequestHandler<GetGroupList, PagedResult<GroupVm>>
{
    private readonly IGroupService _service;

    public GetGroupListHandler(IGroupService service)
    {
        _service = service;
    }

    public async Task<PagedResult<GroupVm>> Handle(GetGroupList request, CancellationToken cancellationToken)
    {
        var groups = await _service.GetListAsync(request.OrganizationId, request.Filter);

        return GroupMapper.ToVm(groups);
    }
}