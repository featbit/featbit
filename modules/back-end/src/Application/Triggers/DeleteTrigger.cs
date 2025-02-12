namespace Application.Triggers;

public class DeleteTrigger : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteTriggerHandler : IRequestHandler<DeleteTrigger, bool>
{
    private readonly ITriggerService _service;

    public DeleteTriggerHandler(ITriggerService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(DeleteTrigger request, CancellationToken cancellationToken)
    {
        await _service.DeleteOneAsync(request.Id);

        return true;
    }
}