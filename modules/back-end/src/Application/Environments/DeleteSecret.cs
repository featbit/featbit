namespace Application.Environments;

public class DeleteSecret : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string SecretId { get; set; }
}

public class DeleteSecretHandler : IRequestHandler<DeleteSecret, bool>
{
    private readonly IEnvironmentService _service;

    public DeleteSecretHandler(IEnvironmentService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(DeleteSecret request, CancellationToken cancellationToken)
    {
        var environment = await _service.GetAsync(request.EnvId);
        environment.RemoveSecret(request.SecretId);
        await _service.UpdateAsync(environment);

        return true;
    }
}