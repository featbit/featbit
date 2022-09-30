namespace Application.Groups;

public class AddGroupMember : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public Guid GroupId { get; set; }

    public Guid MemberId { get; set; }
}

public class AddGroupMemberHandler : IRequestHandler<AddGroupMember, bool>
{
    private readonly IGroupService _service;

    public AddGroupMemberHandler(IGroupService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(AddGroupMember request, CancellationToken cancellationToken)
    {
        await _service.AddMemberAsync(request.OrganizationId, request.GroupId, request.MemberId);

        return true;
    }
}