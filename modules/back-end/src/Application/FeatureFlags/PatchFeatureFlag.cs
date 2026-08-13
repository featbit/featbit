using Domain.AuditLogs;
using Application.Users;
using Application.Bases.Models;
using Domain.FeatureFlags;
using Domain.Policies;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson;

namespace Application.FeatureFlags;

public class PatchFeatureFlag : IRequest<PatchResult>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public JsonPatchDocument<FeatureFlag> Patch { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];
}

public class PatchFeatureFlagHandler(
    IFeatureFlagService flagService,
    IPermissionGuard permissionGuard,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<PatchFeatureFlag, PatchResult>
{
    public async Task<PatchResult> Handle(PatchFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await flagService.GetAsync(request.EnvId, request.Key);
        var dataChange = new DataChange(flag);

        var error = string.Empty;
        request.Patch.ApplyTo(flag, jsonPatchError => error = jsonPatchError.ErrorMessage);

        if (!string.IsNullOrWhiteSpace(error))
        {
            return PatchResult.Fail(error);
        }

        flag.MarkAsUpdated(currentUser.Id);
        dataChange.To(flag);

        await permissionGuard.EnsureFlagChangeAllowedAsync(flag, dataChange, request.Permissions);

        await flagService.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(flag, Operations.Update, dataChange, currentUser.Id);
        await publisher.Publish(notification, cancellationToken);

        return PatchResult.Ok();
    }
}