namespace Application.Environments;

public class DeleteEnvironment : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteEnvironmentHandler : IRequestHandler<DeleteEnvironment, bool>
{
    private readonly IEnvironmentService _service;
    private readonly IPublisher _publisher;

    public DeleteEnvironmentHandler(IEnvironmentService service, IPublisher publisher)
    {
        _service = service;
        _publisher = publisher;
    }

    public async Task<bool> Handle(DeleteEnvironment request, CancellationToken cancellationToken)
    {
        var env = await _service.FindOneAsync(x => x.Id == request.Id);
        if (env == null)
        {
            return true;
        }

        await _service.DeleteAsync(env.Id);

        // publish on environment deleted notification
        await _publisher.Publish(new OnEnvironmentDeleted(env), cancellationToken);

        return true;
    }
}