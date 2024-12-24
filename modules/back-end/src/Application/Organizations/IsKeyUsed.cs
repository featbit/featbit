namespace Application.Organizations;

public class IsKeyUsed : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public string Key { get; set; }
}

public class IsKeyUsedHandler : IRequestHandler<IsKeyUsed, bool>
{
    private readonly IOrganizationService _service;

    public IsKeyUsedHandler(IOrganizationService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(IsKeyUsed request, CancellationToken cancellationToken)
    {
        return await _service.HasKeyBeenUsedAsync(request.WorkspaceId, request.Key);
    }
}