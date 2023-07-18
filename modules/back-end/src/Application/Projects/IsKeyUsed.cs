namespace Application.Projects;

public class IsKeyUsed : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string Key { get; set; }
}

public class IsKeyUsedHandler : IRequestHandler<IsKeyUsed, bool>
{
    private readonly IProjectService _service;

    public IsKeyUsedHandler(IProjectService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(IsKeyUsed request, CancellationToken cancellationToken)
    {
        return await _service.HasKeyBeenUsedAsync(request.OrganizationId, request.Key);
    }
}