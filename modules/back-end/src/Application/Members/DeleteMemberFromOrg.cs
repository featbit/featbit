namespace Application.Members;

public class DeleteMemberFromOrg : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }
}

public class DeleteMemberFromOrgHandler : IRequestHandler<DeleteMemberFromOrg, bool>
{
    private readonly IMemberService _service;

    public DeleteMemberFromOrgHandler(IMemberService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(DeleteMemberFromOrg request, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(request.OrganizationId, request.MemberId);

        return true;
    }
}