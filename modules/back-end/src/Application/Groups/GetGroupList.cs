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
    private readonly IMapper _mapper;

    public GetGroupListHandler(IGroupService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<PagedResult<GroupVm>> Handle(GetGroupList request, CancellationToken cancellationToken)
    {
        var groups = await _service.GetListAsync(request.OrganizationId, request.Filter);

        return _mapper.Map<PagedResult<GroupVm>>(groups);
    }
}