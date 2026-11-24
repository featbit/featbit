using Application.Users;
using Application.Bases;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;

namespace Application.FeatureFlags;

public class CopyFlagSettingsPayload
{
    public FlagSettingCopyOptions Options { get; set; }
}

public class CopyFlagSettings : CopyFlagSettingsPayload, IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];

    public Guid SourceEnvId { get; set; }

    public Guid TargetEnvId { get; set; }

    public string Key { get; set; }

    public CopyFlagSettings(
        Guid workspaceId,
        Guid orgId,
        Guid sourceEnvId,
        Guid targetEnvId,
        string key,
        CopyFlagSettingsPayload payload)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        SourceEnvId = sourceEnvId;
        TargetEnvId = targetEnvId;
        Key = key;

        Options = payload.Options;
    }
}

public class CopyFlagSettingsValidator : AbstractValidator<CopyFlagSettings>
{
    public CopyFlagSettingsValidator()
    {
        RuleFor(x => x.Key).NotEmpty().WithErrorCode(ErrorCodes.Invalid("key"));
        RuleFor(x => x.Options).NotNull().WithErrorCode(ErrorCodes.Invalid("options"));
        RuleFor(x => x.SourceEnvId).NotEmpty().WithErrorCode(ErrorCodes.Invalid("sourceEnvId"));
        RuleFor(x => x.TargetEnvId)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("targetEnvId"))
            .NotEqual(x => x.SourceEnvId).WithErrorCode(ErrorCodes.Invalid("targetEnvId"));
    }
}

public class CopyFlagSettingsHandler(
    IFeatureFlagService flagService,
    IEndUserService endUserService,
    IEnvironmentService envService,
    ICurrentUser currentUser,
    IPublisher publisher,
    FlagAccessGuard access,
    IPermissionGuard permissionGuard)
    : IRequestHandler<CopyFlagSettings, bool>
{
    public async Task<bool> Handle(CopyFlagSettings request, CancellationToken cancellationToken)
    {
        await access.EnsureEnvironmentAccessAsync(request.OrgId, request.SourceEnvId, request.Permissions);
        await access.EnsureEnvironmentAccessAsync(request.OrgId, request.TargetEnvId, request.Permissions);
        var source = await flagService.GetAsync(request.SourceEnvId, request.Key);
        var target = await flagService.GetAsync(request.TargetEnvId, request.Key);
        var relatedSegments = await flagService.GetRelatedSegmentsAsync([source, target]);

        var context = new FlagCopyContext(source, target, relatedSegments, request.Options);
        var dataChange = target.CopySettingsFrom(context, currentUser.Id);
        await permissionGuard.EnsureFlagChangeAllowedAsync(request.OrgId, target, dataChange, request.Permissions);
        await flagService.UpdateAsync(target);

        await AddNewPropertiesAsync();

        var projectEnv = await envService.GetProjectEnvAsync(request.SourceEnvId);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(target, request.WorkspaceId, request.OrgId, Operations.Update, dataChange, currentUser.Id, $"Copy flag settings from \"{projectEnv}\""
        );
        await publisher.Publish(notification, cancellationToken);

        return true;

        async Task AddNewPropertiesAsync()
        {
            var targetEnvProperties = await endUserService.GetPropertiesAsync(request.TargetEnvId);
            var newProperties = FlagCopyHelper.GetNewProperties(source.Rules, targetEnvProperties);
            await endUserService.AddNewPropertiesAsync(request.TargetEnvId, newProperties);
        }
    }
}
