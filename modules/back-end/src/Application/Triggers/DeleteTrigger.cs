namespace Application.Triggers;

public class DeleteTrigger : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteTriggerHandler(ITriggerService service) : IRequestHandler<DeleteTrigger, bool>
{
    public async ValueTask<bool> Handle(DeleteTrigger request, CancellationToken cancellationToken)
    {
        await service.DeleteOneAsync(request.Id);

        return true;
    }
}