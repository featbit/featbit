namespace Application.Experiments;

public class IsKeyUsed : IRequest<bool>
{
    public Guid ProjectId { get; set; }

    public string Key { get; set; }
}

public class IsFeatureFlagKeyUsedHandler : IRequestHandler<IsKeyUsed, bool>
{
    private readonly IEnvironmentService _service;

    public IsFeatureFlagKeyUsedHandler(IEnvironmentService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(IsKeyUsed request, CancellationToken cancellationToken)
    {
        return await _service.AnyAsync(x => x.ProjectId == request.ProjectId && string.Equals(x.Key, request.Key, StringComparison.OrdinalIgnoreCase));
    }
}