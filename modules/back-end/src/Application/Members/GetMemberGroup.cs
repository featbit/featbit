using Application.Bases.Models;

namespace Application.Members;

public class GetMemberGroup : IRequest<PagedResult<MemberGroupVm>>
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }

    public MemberGroupFilter Filter { get; set; }
}

public class GetMemberGroupHandler : IRequestHandler<GetMemberGroup, PagedResult<MemberGroupVm>>
{
    private readonly IMemberService _service;

    public GetMemberGroupHandler(IMemberService service)
    {
        _service = service;
    }
    
    public async Task<PagedResult<MemberGroupVm>> Handle(GetMemberGroup request, CancellationToken cancellationToken)
    {
        var groups = 
            await _service.GetGroupsAsync(request.OrganizationId, request.MemberId, request.Filter);

        return MemberMapper.ToVm(groups);
    }
}