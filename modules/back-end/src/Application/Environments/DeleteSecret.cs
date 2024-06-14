namespace Application.Environments;

public class DeleteSecret : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string SecretId { get; set; }
}

public class DeleteSecretHandler : IRequestHandler<DeleteSecret, bool>
{
    private readonly IEnvironmentService _service;
    private readonly IPublisher _publisher;

    public DeleteSecretHandler(IEnvironmentService service, IPublisher publisher)
    {
        _service = service;
        _publisher = publisher;
    }

    public async Task<bool> Handle(DeleteSecret request, CancellationToken cancellationToken)
    {
        var environment = await _service.GetAsync(request.EnvId);

        var removedSecret = environment.RemoveSecret(request.SecretId);
        if (removedSecret == null)
        {
            return true;
        }

        await _service.UpdateAsync(environment);

        // publish on secret deleted notification
        await _publisher.Publish(new OnSecretDeleted(removedSecret), cancellationToken);

        return true;
    }
}