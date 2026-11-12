using Domain.AuditLogs;
using Application.Users;
using Application.Bases.Models;
using Domain.FeatureFlags;
using Domain.Policies;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson;

namespace Application.FeatureFlags;

public class PatchFeatureFlag : IRequest<PatchResult>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

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
        var flagId = flag.Id;
        var envId = flag.EnvId;
        var dataChange = new DataChange(flag);

        var error = string.Empty;
        request.Patch.ApplyTo(flag, jsonPatchError => error = jsonPatchError.ErrorMessage);

        if (!string.IsNullOrWhiteSpace(error))
        {
            return PatchResult.Fail(error);
        }

        if (flag.Id != flagId || flag.EnvId != envId)
            return PatchResult.Fail("Flag identity and environment cannot be changed by a patch.");

        flag.MarkAsUpdated(currentUser.Id);
        dataChange.To(flag);

        await permissionGuard.EnsureFlagChangeAllowedAsync(flag, dataChange, request.Permissions);

        await flagService.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(flag, request.WorkspaceId, request.OrgId, Operations.Update, dataChange, currentUser.Id);
        await publisher.Publish(notification, cancellationToken);

        return PatchResult.Ok();
    }
}
