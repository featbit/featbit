using System.ComponentModel;
using System.Text.Json;
using System.Text.RegularExpressions;
using Api.Authorization;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.FeatureFlags;
using Application.ReleaseDecisions;
using Application.Services;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.SemanticPatch;
using Domain.Utils;
using Domain.Workspaces;
using ModelContextProtocol.Server;

namespace Api.Mcp;

[McpServerToolType]
public class FeatureFlagMcpTools(
    ISender mediator,
    IReleaseDecisionExperimentService experimentService,
    IHttpContextAccessor httpContextAccessor,
    IPermissionChecker permissionChecker,
    ILicenseService licenseService,
    IRequestPermissions requestPermissions)
{
    [McpServerTool(Name = "featbit_release_decision_get_feature_flag")]
    [Description("Read a FeatBit feature flag by key from the environment attached to a release-decision experiment.")]
    public async Task<FeatureFlag> GetFeatureFlag(
        [Description("Release-decision experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Feature flag key.")]
        string key)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new GetFeatureFlag
        {
            EnvId = envId,
            Key = key
        });
    }

    [McpServerTool(Name = "featbit_release_decision_create_feature_flag")]
    [Description("Create a FeatBit feature flag in the environment attached to a release-decision experiment. If variations are omitted for a boolean flag, standard false/true variations are generated.")]
    public async Task<FeatureFlag> CreateFeatureFlag(
        [Description("Release-decision experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Feature flag creation payload.")]
        FeatureFlagMcpCreateRequest request)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);
        await EnsurePermissionAsync(envId, Permissions.CreateFlag);

        return await mediator.Send(request.ToCreateFeatureFlag(envId));
    }

    [McpServerTool(Name = "featbit_release_decision_update_feature_flag_targeting")]
    [Description("Update feature flag targeting in the experiment environment. By default this applies directly; set useChangeRequest or provide reviewers to create a change request instead.")]
    public async Task<FeatureFlagTargetingUpdateResult> UpdateFeatureFlagTargeting(
        [Description("Release-decision experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Feature flag key.")]
        string key,
        [Description("Targeting update payload. Reviewers are only required when useChangeRequest is true.")]
        FeatureFlagTargetingUpdateRequest request)
    {
        ValidateTargetingUpdateRequest(request);

        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);
        await EnsureTargetingUpdatePermissionsAsync(envId, key, request.Targeting);

        var useChangeRequest = request.UseChangeRequest || request.Reviewers.Count > 0;
        if (!useChangeRequest)
        {
            var payload = new UpdateTargetingPayload
            {
                Revision = request.Revision,
                Targeting = request.Targeting,
                Comment = request.Comment ?? string.Empty
            };
            var revision = await mediator.Send(new UpdateTargeting(
                GetHttpContext().Request.OrganizationId(),
                envId,
                key,
                payload,
                await requestPermissions.GetAsync(GetHttpContext())
            ));

            return new FeatureFlagTargetingUpdateResult
            {
                Mode = FeatureFlagTargetingUpdateModes.Direct,
                Revision = revision
            };
        }

        if (request.Reviewers.Count == 0)
        {
            throw new BusinessException(ErrorCodes.Required("reviewers"));
        }

        await EnsureChangeRequestLicenseAsync();

        await mediator.Send(new CreateFlagChangeRequest
        {
            OrgId = GetHttpContext().Request.OrganizationId(),
            EnvId = envId,
            Key = key,
            Revision = request.Revision,
            Targeting = request.Targeting,
            Reason = request.Reason ?? string.Empty,
            Reviewers = request.Reviewers
        });

        var pendingChanges = await mediator.Send(new GetPendingChanges
        {
            EnvId = envId,
            Key = key
        });

        return new FeatureFlagTargetingUpdateResult
        {
            Mode = FeatureFlagTargetingUpdateModes.ChangeRequest,
            PendingChanges = pendingChanges
        };
    }

    private async Task<Guid> ResolveAuthorizedEnvIdAsync(Guid experimentId)
    {
        var envId = await experimentService.GetEnvIdAsync(experimentId);
        await EnsurePermissionAsync(envId, Permissions.CanAccessEnv);
        return envId;
    }

    private async Task EnsureTargetingUpdatePermissionsAsync(Guid envId, string key, FlagTargeting targeting)
    {
        if (targeting == null)
        {
            throw new BusinessException(ErrorCodes.Required("targeting"));
        }

        var flag = await mediator.Send(new GetFeatureFlag
        {
            EnvId = envId,
            Key = key
        });

        ValidateTargeting(targeting, flag);

        var current = Clone(flag);
        current.TargetUsers = targeting.TargetUsers ?? [];
        current.Rules = targeting.Rules ?? [];
        current.Fallthrough = targeting.Fallthrough ?? throw new BusinessException(ErrorCodes.Required("fallthrough"));
        current.ExptIncludeAllTargets = targeting.ExptIncludeAllTargets;

        var instructions = FlagComparer.Compare(flag, current).ToArray();
        if (instructions.Length == 0)
        {
            throw new BusinessException(ErrorCodes.Invalid("targeting"));
        }

        if (instructions.Any(x => FlagInstructionKind.UpdateDefaultRuleKinds.Contains(x.Kind)))
        {
            await EnsurePermissionAsync(envId, Permissions.UpdateFlagDefaultRule, key);
        }

        if (instructions.Any(x => FlagInstructionKind.UpdateTargetUsersKinds.Contains(x.Kind)))
        {
            await EnsurePermissionAsync(envId, Permissions.UpdateFlagIndividualTargeting, key);
        }

        if (instructions.Any(x => FlagInstructionKind.UpdateRuleKinds.Contains(x.Kind)))
        {
            await EnsurePermissionAsync(envId, Permissions.UpdateFlagTargetingRules, key);
        }
    }

    private async Task EnsureChangeRequestLicenseAsync()
    {
        var workspaceId = GetHttpContext().Request.WorkspaceId();
        if (workspaceId == Guid.Empty ||
            !await licenseService.IsFeatureGrantedAsync(workspaceId, LicenseFeatures.ChangeRequest))
        {
            throw new UnauthorizedAccessException("Current workspace cannot use feature flag change requests.");
        }
    }

    private async Task EnsurePermissionAsync(Guid envId, string permission, string? key = null)
    {
        var httpContext = GetHttpContext();

        httpContext.Request.RouteValues["envId"] = envId.ToString();
        if (key == null)
        {
            httpContext.Request.RouteValues.Remove("key");
        }
        else
        {
            httpContext.Request.RouteValues["key"] = key;
        }

        var requirement = new PermissionRequirement(permission);
        if (!await permissionChecker.IsGrantedAsync(httpContext, requirement))
        {
            throw new UnauthorizedAccessException($"Current principal cannot use permission {permission}.");
        }
    }

    private HttpContext GetHttpContext()
        => httpContextAccessor.HttpContext
           ?? throw new InvalidOperationException("MCP request context is unavailable.");

    private static void ValidateTargetingUpdateRequest(FeatureFlagTargetingUpdateRequest request)
    {
        if (request == null)
        {
            throw new BusinessException(ErrorCodes.Required("request"));
        }

        if (request.Revision == Guid.Empty)
        {
            throw new BusinessException(ErrorCodes.Required("revision"));
        }

        if (request.Targeting == null)
        {
            throw new BusinessException(ErrorCodes.Required("targeting"));
        }

        request.Reviewers ??= [];
    }

    private static void ValidateTargeting(FlagTargeting targeting, FeatureFlag flag)
    {
        var variationIds = flag.Variations.Select(x => x.Id).ToHashSet(StringComparer.Ordinal);

        if (targeting.TargetUsers == null)
        {
            throw new BusinessException(ErrorCodes.Required("targetUsers"));
        }

        if (targeting.Rules == null)
        {
            throw new BusinessException(ErrorCodes.Required("rules"));
        }

        if (targeting.Fallthrough == null)
        {
            throw new BusinessException(ErrorCodes.Required("fallthrough"));
        }

        ValidateRolloutVariations(targeting.Fallthrough.Variations, variationIds, "fallthrough.variations");

        foreach (var targetUser in targeting.TargetUsers)
        {
            if (string.IsNullOrWhiteSpace(targetUser.VariationId) || !variationIds.Contains(targetUser.VariationId))
            {
                throw new BusinessException(ErrorCodes.Invalid("targetUsers.variationId"));
            }

            if (targetUser.KeyIds == null)
            {
                throw new BusinessException(ErrorCodes.Required("targetUsers.keyIds"));
            }
        }

        foreach (var rule in targeting.Rules)
        {
            if (string.IsNullOrWhiteSpace(rule.Id))
            {
                throw new BusinessException(ErrorCodes.Required("rules.id"));
            }

            if (string.IsNullOrWhiteSpace(rule.Name))
            {
                throw new BusinessException(ErrorCodes.Required("rules.name"));
            }

            if (rule.Conditions == null || rule.Conditions.Count == 0)
            {
                throw new BusinessException(ErrorCodes.Required("rules.conditions"));
            }

            ValidateRolloutVariations(rule.Variations, variationIds, "rules.variations");
        }
    }

    private static void ValidateRolloutVariations(
        ICollection<RolloutVariation> rolloutVariations,
        ISet<string> variationIds,
        string parameterName)
    {
        if (rolloutVariations == null || rolloutVariations.Count == 0)
        {
            throw new BusinessException(ErrorCodes.Required(parameterName));
        }

        var total = 0d;
        foreach (var rolloutVariation in rolloutVariations)
        {
            if (string.IsNullOrWhiteSpace(rolloutVariation.Id) || !variationIds.Contains(rolloutVariation.Id))
            {
                throw new BusinessException(ErrorCodes.Invalid($"{parameterName}.id"));
            }

            if (rolloutVariation.Rollout is not { Length: 2 } ||
                rolloutVariation.Rollout[0] < 0 ||
                rolloutVariation.Rollout[1] > 1 ||
                rolloutVariation.Rollout[0] > rolloutVariation.Rollout[1])
            {
                throw new BusinessException(ErrorCodes.Invalid($"{parameterName}.rollout"));
            }

            total += rolloutVariation.Rollout[1] - rolloutVariation.Rollout[0];
        }

        if (Math.Abs(total - 1) > 0.00001)
        {
            throw new BusinessException(ErrorCodes.Invalid($"{parameterName}.rollout"));
        }
    }

    private static FeatureFlag Clone(FeatureFlag flag)
        => JsonSerializer.Deserialize<FeatureFlag>(
            JsonSerializer.Serialize(flag, ReusableJsonSerializerOptions.Web),
            ReusableJsonSerializerOptions.Web)!;
}

public class FeatureFlagMcpCreateRequest
{
    [Description("Feature flag name.")]
    public string Name { get; set; } = string.Empty;

    [Description("Stable unique feature flag key.")]
    public string Key { get; set; } = string.Empty;

    [Description("Feature flag description.")]
    public string Description { get; set; } = string.Empty;

    [Description("Initial enabled status. Prefer false for new experiment flags until targeting is configured.")]
    public bool IsEnabled { get; set; }

    [Description("Variation type: boolean, string, number, or json.")]
    public string VariationType { get; set; } = VariationTypes.Boolean;

    [Description("Feature flag variations. Boolean flags may omit this to use generated false/true variations.")]
    public ICollection<Variation> Variations { get; set; } = [];

    [Description("Variation id served when the flag is enabled. Optional for generated boolean variations.")]
    public string EnabledVariationId { get; set; } = string.Empty;

    [Description("Variation id served when the flag is disabled. Optional for generated boolean variations.")]
    public string DisabledVariationId { get; set; } = string.Empty;

    [Description("Feature flag tags.")]
    public string[] Tags { get; set; } = [];

    public CreateFeatureFlag ToCreateFeatureFlag(Guid envId)
    {
        Validate();

        var variations = Variations ?? Array.Empty<Variation>();
        if (variations.Count == 0 && VariationType == VariationTypes.Boolean)
        {
            variations =
            [
                new Variation { Id = Guid.NewGuid().ToString(), Name = "Off", Value = "false" },
                new Variation { Id = Guid.NewGuid().ToString(), Name = "On", Value = "true" }
            ];
        }

        return new CreateFeatureFlag
        {
            EnvId = envId,
            Name = Name,
            Key = Key,
            Description = Description ?? string.Empty,
            IsEnabled = IsEnabled,
            VariationType = VariationType,
            Variations = variations,
            DisabledVariationId = ResolveVariationId(DisabledVariationId, variations, "false", first: true),
            EnabledVariationId = ResolveVariationId(EnabledVariationId, variations, "true", first: false),
            Tags = Tags ?? []
        };
    }

    private void Validate()
    {
        if (string.IsNullOrWhiteSpace(Name))
        {
            throw new BusinessException(ErrorCodes.Required("name"));
        }

        if (string.IsNullOrWhiteSpace(Key))
        {
            throw new BusinessException(ErrorCodes.Required("key"));
        }

        if (!Regex.IsMatch(Key, FeatureFlag.KeyPattern))
        {
            throw new BusinessException(ErrorCodes.Invalid("key"));
        }

        if (!VariationTypes.IsDefined(VariationType))
        {
            throw new BusinessException(ErrorCodes.Invalid("variationType"));
        }

        if (VariationType != VariationTypes.Boolean && (Variations == null || Variations.Count == 0))
        {
            throw new BusinessException(ErrorCodes.Required("variations"));
        }

        if (Variations != null && Variations.Any(x => !x.IsValid()))
        {
            throw new BusinessException(ErrorCodes.Invalid("variations"));
        }
    }

    private static string ResolveVariationId(
        string configuredId,
        ICollection<Variation> variations,
        string value,
        bool first)
    {
        if (!string.IsNullOrWhiteSpace(configuredId))
        {
            return configuredId;
        }

        var variation = variations.FirstOrDefault(x => x.Value == value)
                        ?? (first ? variations.FirstOrDefault() : variations.LastOrDefault());

        return variation?.Id ?? string.Empty;
    }
}

public class FeatureFlagTargetingUpdateRequest
{
    [Description("Current feature flag revision for optimistic concurrency.")]
    public Guid Revision { get; set; }

    [Description("New targeting state for target users, rules, default rule, and experiment target inclusion.")]
    public FlagTargeting Targeting { get; set; } = null!;

    [Description("Direct update audit comment.")]
    public string Comment { get; set; } = string.Empty;

    [Description("When true, create a feature flag change request instead of applying directly.")]
    public bool UseChangeRequest { get; set; }

    [Description("Reason for the change request. Used only when creating a change request.")]
    public string Reason { get; set; } = string.Empty;

    [Description("Member ids who must review this change request. Providing reviewers also selects change-request mode.")]
    public ICollection<Guid> Reviewers { get; set; } = [];
}

public class FeatureFlagTargetingUpdateResult
{
    public string Mode { get; set; } = FeatureFlagTargetingUpdateModes.Direct;

    public Guid? Revision { get; set; }

    public IEnumerable<PendingChangesVm> PendingChanges { get; set; } = [];
}

public static class FeatureFlagTargetingUpdateModes
{
    public const string Direct = "direct";

    public const string ChangeRequest = "change-request";
}
