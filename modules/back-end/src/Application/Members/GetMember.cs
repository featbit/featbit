namespace Application.Members;

public class GetMember : IRequest<MemberVm>
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }
}

public class GetMemberHandler : IRequestHandler<GetMember, MemberVm>
{
    private readonly IMemberService _service;

    public GetMemberHandler(IMemberService service)
    {
        _service = service;
    }
    
    public async Task<MemberVm> Handle(GetMember request, CancellationToken cancellationToken)
    {
        var member = await _service.GetAsync(request.OrganizationId, request.MemberId);

        return MemberMapper.ToVm(member);
    }
}