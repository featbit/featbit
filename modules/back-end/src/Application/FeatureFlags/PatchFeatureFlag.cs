using Application.Bases.Exceptions;
using Domain.AuditLogs;
using Application.Users;
using Application.Bases.Models;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.SemanticPatch;
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
    IResourceService resourceService,
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

        await CheckPermissionsAsync();

        await flagService.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(flag, Operations.Update, dataChange, currentUser.Id);
        await publisher.Publish(notification, cancellationToken);

        return PatchResult.Ok();

        async Task CheckPermissionsAsync()
        {
            var instructions = FlagComparer.Compare(dataChange).ToArray();
            var requiredPermissions = instructions
                .Select(x => x.Permission)
                .Where(permission => !string.IsNullOrEmpty(permission))
                .ToHashSet();

            if (requiredPermissions.Count == 0)
            {
                return;
            }

            var rn = await resourceService.GetFlagRnAsync(flag.EnvId, flag.Key);
            if (requiredPermissions.Any(permission => !PolicyHelper.IsAllowed(request.Permissions, rn, permission)))
            {
                throw new ForbiddenException();
            }
        }
    }
}