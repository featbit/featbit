namespace Application.FeatureFlags;

public class DeleteFlagChangeRequest : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteFlagChangeRequestHandler : IRequestHandler<DeleteFlagChangeRequest, bool>
{
    private readonly IFlagChangeRequestService _flagChangeRequestService;

    public DeleteFlagChangeRequestHandler(IFlagChangeRequestService flagChangeRequestService)
    {
        _flagChangeRequestService = flagChangeRequestService;
    }

    public async Task<bool> Handle(DeleteFlagChangeRequest request, CancellationToken cancellationToken)
    {
        await _flagChangeRequestService.DeleteAsync(request.Id);

        return true;
    }
}