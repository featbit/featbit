namespace Application.Projects;

public class DeleteProject : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteProjectHandler : IRequestHandler<DeleteProject, bool>
{
    private readonly IProjectService _service;

    public DeleteProjectHandler(IProjectService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(DeleteProject request, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(request.Id);

        return true;
    }
}