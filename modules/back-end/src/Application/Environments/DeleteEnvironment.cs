namespace Application.Environments;

public class DeleteEnvironment : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteEnvironmentHandler : IRequestHandler<DeleteEnvironment, bool>
{
    private readonly IEnvironmentService _service;

    public DeleteEnvironmentHandler(IEnvironmentService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(DeleteEnvironment request, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(request.Id);
        
        return true;
    }
}