using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;

namespace Application.FeatureFlags;

public class CopyToEnvPayload
{
    public CopyToEnvPrecheckResult[] PrecheckResults { get; set; } = [];

    public ICollection<Guid> FlagIds { get; set; } = Array.Empty<Guid>();
}

public class CopyToEnv : CopyToEnvPayload, IRequest<CopyToEnvResult>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public PolicyStatement[] Permissions { get; }

    public Guid SourceEnvId { get; set; }

    public Guid TargetEnvId { get; set; }

    public CopyToEnv(
        Guid workspaceId,
        Guid orgId,
        Guid sourceEnvId,
        Guid targetEnvId,
        PolicyStatement[] permissions,
        CopyToEnvPayload payload)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        SourceEnvId = sourceEnvId;
        TargetEnvId = targetEnvId;
        Permissions = permissions;

        PrecheckResults = payload.PrecheckResults;
        FlagIds = payload.FlagIds;
    }
}

public class CopyToEnvHandler(
    IFeatureFlagService flagService,
    IEndUserService endUserService,
    IEnvironmentService envService,
    ICurrentUser currentUser,
    IPublisher publisher,
    FlagCopyChecks copyChecks)
    : IRequestHandler<CopyToEnv, CopyToEnvResult>
{
    public async Task<CopyToEnvResult> Handle(CopyToEnv request, CancellationToken cancellationToken)
    {
        var context = new CopyToEnvContext(
            request.OrgId, request.SourceEnvId, request.TargetEnvId, request.FlagIds, request.Permissions
        );

        var flags = await copyChecks.EnsureCopyAllowedAsync(context);
        if (flags.Count == 0)
        {
            return new CopyToEnvResult(0);
        }

        var precheckResults = await copyChecks.CheckAsync(flags, request.TargetEnvId);
        var copiedCount = 0;
        var newProperties = new HashSet<string>();

        var projectEnv = await envService.GetProjectEnvAsync(request.SourceEnvId);
        foreach (var flag in flags)
        {
            await CopyAsync(flag);
        }

        var newPropertiesToAdd = newProperties.ToArray();
        if (newPropertiesToAdd.Length > 0)
        {
            await endUserService.AddNewPropertiesAsync(request.TargetEnvId, newPropertiesToAdd);
        }

        return new CopyToEnvResult(copiedCount);

        async Task CopyAsync(FeatureFlag flag)
        {
            var precheckResult = precheckResults.FirstOrDefault(x => x.Id == flag.Id);
            var selection = request.PrecheckResults?.FirstOrDefault(x => x.Id == flag.Id);
            if (precheckResult is not { KeyCheck: true } || selection is not { KeyCheck: true })
            {
                return;
            }

            var keepRules = precheckResult.TargetRuleCheck && selection.TargetRuleCheck;
            if (keepRules) newProperties.UnionWith(precheckResult.NewProperties);
            flag.CopyToEnv(request.TargetEnvId, currentUser.Id, keepRules);
            await flagService.AddOneAsync(flag);
            copiedCount++;

            // publish on feature flag change notification
            var dataChange = new DataChange(null).To(flag);
            var notification = new OnFeatureFlagChanged(flag, request.WorkspaceId, request.OrgId, Operations.Create, dataChange, currentUser.Id, $"Copied from \"{projectEnv}\""
            );
            await publisher.Publish(notification, cancellationToken);
        }
    }
}
