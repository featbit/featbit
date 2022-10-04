namespace Application.EndUsers;

public class DeleteEndUserProperty : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteEndUserPropertyHandler : IRequestHandler<DeleteEndUserProperty, bool>
{
    private readonly IEndUserService _service;

    public DeleteEndUserPropertyHandler(IEndUserService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(DeleteEndUserProperty request, CancellationToken cancellationToken)
    {
        await _service.DeletePropertyAsync(request.Id);

        return true;
    }
}