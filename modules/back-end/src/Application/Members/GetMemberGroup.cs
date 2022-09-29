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
    private readonly IMapper _mapper;

    public GetMemberGroupHandler(IMemberService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }
    
    public async Task<PagedResult<MemberGroupVm>> Handle(GetMemberGroup request, CancellationToken cancellationToken)
    {
        var groups = 
            await _service.GetGroupsAsync(request.OrganizationId, request.MemberId, request.Filter);

        return _mapper.Map<PagedResult<MemberGroupVm>>(groups);
    }
}