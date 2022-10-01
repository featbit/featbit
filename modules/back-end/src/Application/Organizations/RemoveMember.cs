namespace Application.Organizations;

public class RemoveUser : IRequest<bool>
{
    public Guid OrganizationId { get; set; }
    
    public Guid MemberId { get; set; }
}

public class RemoveUserHandler : IRequestHandler<RemoveUser, bool>
{
    private readonly IOrganizationService _service;

    public RemoveUserHandler(IOrganizationService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(RemoveUser request, CancellationToken cancellationToken)
    {
        await _service.RemoveUserAsync(request.OrganizationId, request.MemberId);

        return true;
    }
}