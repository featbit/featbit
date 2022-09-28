namespace Application.Members;

public class GetMember : IRequest<MemberVm>
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }
}

public class GetMemberHandler : IRequestHandler<GetMember, MemberVm>
{
    private readonly IMemberService _service;
    private readonly IMapper _mapper;

    public GetMemberHandler(IMemberService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }
    
    public async Task<MemberVm> Handle(GetMember request, CancellationToken cancellationToken)
    {
        var member = await _service.GetAsync(request.OrganizationId, request.MemberId);

        return _mapper.Map<MemberVm>(member);
    }
}