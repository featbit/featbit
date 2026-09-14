using Application.AuditLogs;
using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using FluentValidation.Results;

namespace Application.FeatureFlags;

public class ToggleFeatureFlag : ResourceChangeRequest, IRequest<Guid>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public bool Status { get; set; }
}

public class ToggleFeatureFlagHandler : IRequestHandler<ToggleFeatureFlag, Guid>
{
    private readonly IFeatureFlagService _service;
    private readonly IEnvironmentService _environmentService;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public ToggleFeatureFlagHandler(
        IFeatureFlagService service,
        IEnvironmentService environmentService,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _service = service;
        _environmentService = environmentService;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<Guid> Handle(ToggleFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        if (string.IsNullOrWhiteSpace(request.Comment))
        {
            var environment = await _environmentService.GetAsync(request.EnvId);
            if (environment.Settings?.RequireChangeComment == true)
            {
                throw new ValidationException([
                    new ValidationFailure(nameof(request.Comment), "A change comment is required.")
                    {
                        ErrorCode = ErrorCodes.Required("comment")
                    }
                ]);
            }
        }

        if (flag.IsEnabled == request.Status)
        {
            return flag.Revision;
        }

        var dataChange = flag.Toggle(_currentUser.Id, request.Status);
        await _service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification =
            new OnFeatureFlagChanged(flag, Operations.Update, dataChange, _currentUser.Id, request.Comment);
        await _publisher.Publish(notification, cancellationToken);

        return flag.Revision;
    }
}
