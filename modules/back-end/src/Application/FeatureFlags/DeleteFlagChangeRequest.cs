namespace Application.FeatureFlags;

public class DeleteFlagChangeRequest : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteFlagChangeRequestHandler(IFlagChangeRequestService service)
    : IRequestHandler<DeleteFlagChangeRequest, bool>
{
    public async Task<bool> Handle(DeleteFlagChangeRequest request, CancellationToken cancellationToken)
    {
        await service.DeleteOneAsync(request.Id);

        return true;
    }
}