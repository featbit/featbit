using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class CopyFlagSettings : IRequest<bool>
{
    public string Key { get; set; }

    public Guid SourceEnvId { get; set; }

    public Guid TargetEnvId { get; set; }

    public FlagSettingCopyOptions Options { get; set; }
}

public class CopyFlagSettingsHandler(
    IFeatureFlagService flagService,
    IEndUserService endUserService,
    IEnvironmentService envService,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<CopyFlagSettings, bool>
{
    public async Task<bool> Handle(CopyFlagSettings request, CancellationToken cancellationToken)
    {
        var source = await flagService.GetAsync(request.SourceEnvId, request.Key);
        var target = await flagService.GetAsync(request.TargetEnvId, request.Key);
        var relatedSegments = await flagService.GetRelatedSegmentsAsync([source, target]);

        var context = new FlagCopyContext(source, target, relatedSegments, request.Options);
        var dataChange = target.CopySettingsFrom(context, currentUser.Id);
        await flagService.UpdateAsync(target);

        await AddNewPropertiesAsync();

        var projectEnv = await envService.GetProjectEnvAsync(request.SourceEnvId);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(
            target, Operations.Update, dataChange, currentUser.Id, $"Copy flag settings from \"{projectEnv}\""
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