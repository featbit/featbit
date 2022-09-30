namespace Application.Groups;

public class DeleteGroup : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteGroupHandler : IRequestHandler<DeleteGroup, bool>
{
    private readonly IGroupService _service;

    public DeleteGroupHandler(IGroupService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(DeleteGroup request, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(request.Id);

        return true;
    }
}
