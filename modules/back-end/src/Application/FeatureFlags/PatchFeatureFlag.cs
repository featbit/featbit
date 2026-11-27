using Domain.AuditLogs;
using Application.Users;
using Application.Bases;
using Application.Bases.Models;
using Domain.FeatureFlags;
using Domain.Policies;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson.Operations;

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

public class PatchFeatureFlagValidator : AbstractValidator<PatchFeatureFlag>
{
    // Only business fields understood by FlagComparer may be written. New entity fields
    // must be explicitly reviewed before becoming part of the public patch API.
    private static readonly HashSet<string> WritableFields = new(StringComparer.OrdinalIgnoreCase)
    {
        nameof(FeatureFlag.Name), nameof(FeatureFlag.Description), nameof(FeatureFlag.Tags),
        nameof(FeatureFlag.VariationType), nameof(FeatureFlag.Variations),
        nameof(FeatureFlag.TargetUsers), nameof(FeatureFlag.Rules),
        nameof(FeatureFlag.IsEnabled), nameof(FeatureFlag.DisabledVariationId),
        nameof(FeatureFlag.Fallthrough), nameof(FeatureFlag.InsightsEnabled), nameof(FeatureFlag.IsArchived)
    };

    public PatchFeatureFlagValidator()
    {
        RuleFor(x => x.Patch)
            .NotNull().WithErrorCode(ErrorCodes.Required("patch"));

        // Validate all paths, including test operations, before the handler applies any operation;
        // move also requires a writable source because it removes the source value.
        When(x => x.Patch != null, () =>
        {
            RuleForEach(x => x.Patch.Operations).ChildRules(operation =>
            {
                operation.RuleFor(x => x.path)
                    .Must(IsWritablePath)
                    .WithMessage("The path '{PropertyValue}' cannot be used by a feature flag patch.")
                    .WithErrorCode(ErrorCodes.Invalid("path"));

                operation.RuleFor(x => x.from)
                    .Must((op, from) => op.OperationType != OperationType.Move ||
                        IsWritablePath(from))
                    .WithMessage("The source path '{PropertyValue}' cannot be used by a feature flag patch.")
                    .WithErrorCode(ErrorCodes.Invalid("from"));
            });
        });
    }

    private static bool IsWritablePath(string path)
    {
        if (string.IsNullOrEmpty(path) || path[0] != '/')
        {
            return false;
        }

        var field = path.Split('/')[1];
        return WritableFields.Contains(field);
    }
}

public class PatchFeatureFlagHandler(
    IFeatureFlagService flagService,
    FlagPermissionGuard flagGuard,
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

        await flagGuard.EnsureChangeAllowedAsync(request.OrgId, flag, dataChange, request.Permissions);

        await flagService.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(flag, request.WorkspaceId, request.OrgId, Operations.Update, dataChange, currentUser.Id);
        await publisher.Publish(notification, cancellationToken);

        return PatchResult.Ok();
    }
}
