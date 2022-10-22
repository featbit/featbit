using Application.Bases;
using Application.Bases.Exceptions;

namespace Application.FeatureFlags;

public class DeleteFeatureFlag : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class DeleteFeatureFlagHandler : IRequestHandler<DeleteFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly IPublisher _publisher;

    public DeleteFeatureFlagHandler(IFeatureFlagService service, IPublisher publisher)
    {
        _service = service;
        _publisher = publisher;
    }

    public async Task<bool> Handle(DeleteFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);
        if (!flag.IsArchived)
        {
            throw new BusinessException(ErrorCodes.CannotDeleteUnArchivedFeatureFlag);
        }

        await _service.DeleteAsync(request.Id);

        // publish on feature flag delete notification
        await _publisher.Publish(new OnFeatureFlagDeleted(request.EnvId, request.Id), cancellationToken);

        return true;
    }
}