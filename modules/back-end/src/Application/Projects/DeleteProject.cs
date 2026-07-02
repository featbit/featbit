namespace Application.Projects;

public class DeleteProject : IRequest<bool>
{
    /// <summary>
    /// The ID of the project to delete
    /// </summary>
    public Guid Id { get; set; }
}

public class DeleteProjectHandler : IRequestHandler<DeleteProject, bool>
{
    private readonly IProjectService _service;
    private readonly IPublisher _publisher;

    public DeleteProjectHandler(IProjectService service, IPublisher publisher)
    {
        _service = service;
        _publisher = publisher;
    }

    public async Task<bool> Handle(DeleteProject request, CancellationToken cancellationToken)
    {
        var projectWithEnvs = await _service.GetWithEnvsAsync(request.Id);
        if (projectWithEnvs == null)
        {
            return true;
        }

        await _service.DeleteAsync(projectWithEnvs.Id);

        // publish on project deleted notification
        await _publisher.Publish(new OnProjectDeleted(projectWithEnvs), cancellationToken);

        return true;
    }
}