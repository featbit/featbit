using Application.Bases;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class UpdateName : IRequest<Guid>
{
    /// <summary>
    /// The ID of the environment the feature flag belongs to. Retrieved from the URL path.
    /// </summary>
    public Guid EnvId { get; set; }

    /// <summary>
    /// The unique key of the feature flag. Retrieved from the URL path.
    /// </summary>
    public string Key { get; set; }

    /// <summary>
    /// The new name for the feature flag
    /// </summary>
    public string Name { get; set; }
}

public class UpdateNameValidator : AbstractValidator<UpdateName>
{
    public UpdateNameValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class UpdateNameHandler(
    IFeatureFlagService service,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<UpdateName, Guid>
{
    public async Task<Guid> Handle(UpdateName request, CancellationToken cancellationToken)
    {
        var flag = await service.GetAsync(request.EnvId, request.Key);
        if (flag.Name == request.Name)
        {
            return flag.Revision;
        }

        var dataChange = flag.UpdateName(request.Name, currentUser.Id);
        await service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(
            flag,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: "Updated name"
        );
        await publisher.Publish(notification, cancellationToken);

        return flag.Revision;
    }
}