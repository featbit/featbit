namespace Application.FeatureFlags;

public class DeleteFlagChangeRequest : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteFlagChangeRequestHandler : IRequestHandler<DeleteFlagChangeRequest, bool>
{
    private readonly IFlagChangeRequestService _service;

    public DeleteFlagChangeRequestHandler(IFlagChangeRequestService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(DeleteFlagChangeRequest request, CancellationToken cancellationToken)
    {
        await _service.DeleteOneAsync(request.Id);

        return true;
    }
}