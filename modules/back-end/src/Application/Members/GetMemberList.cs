using Application.Bases.Models;
using Application.Users;

namespace Application.Members;

public class GetMemberList : PagedRequest, IRequest<PagedResult<MemberVm>>
{
    public Guid OrganizationId { get; set; }

    public MemberFilter Filter { get; set; }
}

public class GetMemberListHandler : IRequestHandler<GetMemberList, PagedResult<MemberVm>>
{
    private readonly IMemberService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IMapper _mapper;

    public GetMemberListHandler(IMemberService service, ICurrentUser currentUser, IMapper mapper)
    {
        _service = service;
        _currentUser = currentUser;
        _mapper = mapper;
    }

    public async Task<PagedResult<MemberVm>> Handle(GetMemberList request, CancellationToken cancellationToken)
    {
        var members =
            await _service.GetListAsync(request.OrganizationId, request.Filter);
        
        foreach (var member in members.Items)
        {
            // only invitor can view member's initial password
            if (_currentUser.Id != member.InvitorId)
            {
                member.InitialPassword = null;
            }
        }

        return _mapper.Map<PagedResult<MemberVm>>(members);
    }
}