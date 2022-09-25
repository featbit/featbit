using Application.Bases.Models;

namespace Application.Members;

public class GetMemberList : PagedRequest, IRequest<PagedResult<MemberVm>>
{
    public string CurrentUserId { get; set; }
    
    public string OrganizationId { get; set; }

    public MemberFilter Filter { get; set; }
}

public class GetMemberListHandler : IRequestHandler<GetMemberList, PagedResult<MemberVm>>
{
    private readonly IMemberService _service;
    private readonly IMapper _mapper;

    public GetMemberListHandler(IMemberService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<PagedResult<MemberVm>> Handle(GetMemberList request, CancellationToken cancellationToken)
    {
        var members =
            await _service.GetListAsync(request.OrganizationId, request.Filter);
        
        foreach (var member in members.Items)
        {
            // only invitor can view member's initial password
            if (request.CurrentUserId != member.InvitorId)
            {
                member.InitialPassword = null;
            }
        }

        return _mapper.Map<PagedResult<MemberVm>>(members);
    }
}