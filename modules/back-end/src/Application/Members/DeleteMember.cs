namespace Application.Members;

public class DeleteMember : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }
}

public class DeleteMemberHandler : IRequestHandler<DeleteMember, bool>
{
    private readonly IMemberService _service;

    public DeleteMemberHandler(IMemberService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(DeleteMember request, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(request.OrganizationId, request.MemberId);

        return true;
    }
}