using Application.AuditLogs;
using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using Domain.Policies;

namespace Application.FeatureFlags;

public class UpdateGeneralPayload : ResourceChangeRequest
{
    /// <summary>
    /// The new name for the feature flag.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The new description for the feature flag.
    /// </summary>
    public string Description { get; set; }

    /// <summary>
    /// The collection of tags to set for the feature flag.
    /// </summary>
    public string[] Tags { get; set; }
}

public class UpdateGeneral : UpdateGeneralPayload, IRequest<Guid>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public PolicyStatement[] Permissions { get; set; }

    public UpdateGeneral(
        Guid envId,
        string key,
        UpdateGeneralPayload payload,
        PolicyStatement[] permissions)
    {
        EnvId = envId;
        Key = key;
        Name = payload.Name;
        Description = payload.Description;
        Tags = payload.Tags;
        Comment = payload.Comment;
        Permissions = permissions;
    }
}

public class UpdateGeneralValidator : AbstractValidator<UpdateGeneral>
{
    public UpdateGeneralValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"))
            .MaximumLength(128).WithErrorCode(ErrorCodes.Invalid("name"));
    }
}

public class UpdateGeneralHandler(
    IFeatureFlagService service,
    IPermissionGuard permissionGuard,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<UpdateGeneral, Guid>
{
    public async Task<Guid> Handle(UpdateGeneral request, CancellationToken cancellationToken)
    {
        var flag = await service.GetAsync(request.EnvId, request.Key);
        var requestedTags = request.Tags ?? [];
        var currentTags = flag.Tags ?? [];

        var nameChanged = flag.Name != request.Name;
        var descriptionChanged = flag.Description != request.Description;
        var tagsChanged = !currentTags.ToHashSet().SetEquals(requestedTags);

        if (!nameChanged && !descriptionChanged && !tagsChanged)
        {
            return flag.Revision;
        }

        var dataChange = flag.UpdateGeneral(
            request.Name,
            request.Description,
            tagsChanged ? requestedTags : currentTags,
            currentUser.Id
        );
        await permissionGuard.EnsureFlagChangeAllowedAsync(flag, dataChange, request.Permissions);
        await service.UpdateAsync(flag);

        var notification = new OnFeatureFlagChanged(
            flag,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: request.Comment
        );
        await publisher.Publish(notification, cancellationToken);

        return flag.Revision;
    }
}
