namespace Application.Groups;

public class RemoveGroupMember : IRequest<bool>
{
    public Guid GroupId { get; set; }

    public Guid MemberId { get; set; }
}

public class RemoveGroupMemberHandler : IRequestHandler<RemoveGroupMember, bool>
{
    private readonly IGroupService _service;

    public RemoveGroupMemberHandler(IGroupService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(RemoveGroupMember request, CancellationToken cancellationToken)
    {
        await _service.RemoveMemberAsync(request.GroupId, request.MemberId);

        return true;
    }
}