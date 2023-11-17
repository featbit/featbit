namespace Application.Members;

public class RemoveFromOrganization : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }
}

public class RemoveFromOrganizationHandler : IRequestHandler<RemoveFromOrganization, bool>
{
    private readonly IMemberService _service;

    public RemoveFromOrganizationHandler(IMemberService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(RemoveFromOrganization request, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(request.OrganizationId, request.MemberId);

        return true;
    }
}