using Application.Bases;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class UpdateName : IRequest<Guid>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

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