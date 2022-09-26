namespace Application.Groups;

public class IsNameUsed : IRequest<bool>
{
    public string OrganizationId { get; set; }

    public string Name { get; set; }
}

public class IsNameUsedHandler : IRequestHandler<IsNameUsed, bool>
{
    private readonly IGroupService _service;

    public IsNameUsedHandler(IGroupService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(IsNameUsed request, CancellationToken cancellationToken)
    {
        var isNameUsed = await _service.IsNameUsedAsync(request.OrganizationId, request.Name);

        return isNameUsed;
    }
}