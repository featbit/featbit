using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class UpdateDescription : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }
}

public class UpdateDescriptionHandler : IRequestHandler<UpdateDescription, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public UpdateDescriptionHandler(
        IFeatureFlagService service,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<bool> Handle(UpdateDescription request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.UpdateDescription(request.Description, _currentUser.Id);
        await _service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(
            flag, 
            Operations.Update, 
            dataChange, 
            _currentUser.Id,
            comment: "Updated description"
        );
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}