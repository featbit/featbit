namespace Application.Groups;

public class IsGroupNameUsed : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }
}

public class IsGroupNameUsedHandler : IRequestHandler<IsGroupNameUsed, bool>
{
    private readonly IGroupService _service;

    public IsGroupNameUsedHandler(IGroupService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(IsGroupNameUsed request, CancellationToken cancellationToken)
    {
        var isNameUsed = await _service.IsNameUsedAsync(request.OrganizationId, request.Name);

        return isNameUsed;
    }
}