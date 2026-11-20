using Application.Users;
using Application.Bases;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using System.Text.Json.Serialization;

namespace Application.FeatureFlags;

public class CopyToEnv : IRequest<CopyToEnvResult>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId {get; set;}

    [JsonIgnore]
    public PolicyStatement[] Permissions { get; set; } = [];

    public Guid SourceEnvId { get; set; }

    public Guid TargetEnvId { get; set; }

    public CopyToEnvPrecheckResult[] PrecheckResults { get; set; } = [];

    public ICollection<Guid> FlagIds { get; set; } = Array.Empty<Guid>();
}

public class CopyToEnvValidator : AbstractValidator<CopyToEnv>
{
    public CopyToEnvValidator()
    {
        RuleFor(x => x.FlagIds).NotEmpty().WithErrorCode(ErrorCodes.Invalid("flagIds"));
        RuleFor(x => x.SourceEnvId).NotEmpty().WithErrorCode(ErrorCodes.Invalid("sourceEnvId"));
        RuleFor(x => x.TargetEnvId)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("targetEnvId"))
            .NotEqual(x => x.SourceEnvId)
            .WithErrorCode(ErrorCodes.Invalid("targetEnvId"));
    }
}

public class CopyToEnvHandler(
    IFeatureFlagService flagService,
    IEndUserService endUserService,
    IEnvironmentService envService,
    ICurrentUser currentUser,
    IPublisher publisher,
    FlagAccessGuard access,
    FlagCopyPrecheck precheck)
    : IRequestHandler<CopyToEnv, CopyToEnvResult>
{
    public async Task<CopyToEnvResult> Handle(CopyToEnv request, CancellationToken cancellationToken)
    {
        var flags = await access.GetAuthorizedFlagsForCopyAsync(request.OrgId, request.SourceEnvId,
            request.TargetEnvId, request.FlagIds, request.Permissions);
        // Recompute validation and derived properties; the client only chooses which flags/rules to copy.
        var precheckResults = await precheck.CheckAsync(flags, request.TargetEnvId);
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
