using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;

namespace Application.FeatureFlags;

public class DeleteFeatureFlag : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }
}

public class DeleteFeatureFlagHandler : IRequestHandler<DeleteFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly IPublisher _publisher;
    private readonly ICurrentUser _currentUser;

    public DeleteFeatureFlagHandler(
        IFeatureFlagService service,
        IPublisher publisher,
        ICurrentUser currentUser)
    {
        _service = service;
        _publisher = publisher;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(DeleteFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        if (!flag.IsArchived)
        {
            throw new BusinessException(ErrorCodes.CannotDeleteUnArchivedFeatureFlag);
        }

        await _service.DeleteAsync(flag.Id);

        // publish on feature flag delete notification
        await _publisher.Publish(new OnFeatureFlagDeleted(flag, _currentUser.Id), cancellationToken);

        return true;
    }
}