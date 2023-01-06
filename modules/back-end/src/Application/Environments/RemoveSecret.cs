namespace Application.Environments;

public class RemoveSecret : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string SecretId { get; set; }
}

public class RemoveSecretHandler : IRequestHandler<RemoveSecret, bool>
{
    private readonly IEnvironmentService _service;

    public RemoveSecretHandler(IEnvironmentService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(RemoveSecret request, CancellationToken cancellationToken)
    {
        var environment = await _service.GetAsync(request.EnvId);
        environment.RemoveSecret(request.SecretId);
        await _service.UpdateAsync(environment);

        return true;
    }
}