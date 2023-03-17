namespace Application.Environments;

public class IsKeyUsed : IRequest<bool>
{
    public Guid ProjectId { get; set; }

    public string Key { get; set; }
}

public class IsKeyUsedHandler : IRequestHandler<IsKeyUsed, bool>
{
    private readonly IEnvironmentService _service;

    public IsKeyUsedHandler(IEnvironmentService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(IsKeyUsed request, CancellationToken cancellationToken)
    {
        return await _service.AnyAsync(x =>
            x.ProjectId == request.ProjectId &&
            string.Equals(x.Key, request.Key, StringComparison.OrdinalIgnoreCase)
        );
    }
}