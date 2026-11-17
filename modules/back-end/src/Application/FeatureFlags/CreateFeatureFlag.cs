using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Application.Bases.Exceptions;

namespace Application.FeatureFlags;


public class CreateFeatureFlagPayload
{
    /// <summary>
    /// The name of the feature flag.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The unique key of the feature flag.
    /// </summary>
    public string Key { get; set; }

    /// <summary>
    /// The status of the feature flag.
    /// </summary>
    public bool IsEnabled { get; set; }

    /// <summary>
    /// The description of the feature flag.
    /// </summary>
    public string Description { get; set; }

    /// <summary>
    /// The variation type of the feature flag.
    /// </summary>
    public string VariationType { get; set; }

    /// <summary>
    /// The collection of variations (different values the feature flag can return).
    /// </summary>
    public ICollection<Variation> Variations { get; set; }

    /// <summary>
    /// The ID of the variation to serve when the flag is enabled.
    /// </summary>
    public string EnabledVariationId { get; set; }

    /// <summary>
    /// The ID of the variation to serve when the flag is disabled.
    /// </summary>
    public string DisabledVariationId { get; set; }

    /// <summary>
    /// The list of tags associated with the feature flag.
    /// </summary>
    public string[] Tags { get; set; }

    /// <summary>
    /// Whether evaluation insights are collected for this flag. Defaults to true.
    /// </summary>
    public bool InsightsEnabled { get; set; } = true;
}

public class CreateFeatureFlag : CreateFeatureFlagPayload, IRequest<FeatureFlag>
{
    public Guid EnvId { get; set; }

    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public FeatureFlag AsFeatureFlag(Guid currentUserId)
    {
        var flag = new FeatureFlag(
            EnvId,
            Name,
            Description,
            Key,
            IsEnabled,
            VariationType,
            Variations,
            DisabledVariationId,
            EnabledVariationId,
            Tags,
            currentUserId
        )
        {
            InsightsEnabled = InsightsEnabled
        };

        return flag;
    }

    public CreateFeatureFlag(Guid workspaceId, Guid orgId, Guid envId, CreateFeatureFlagPayload payload)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        EnvId = envId;

        Name = payload.Name;
        Key = payload.Key;
        IsEnabled = payload.IsEnabled;
        Description = payload.Description;
        VariationType = payload.VariationType;
        Variations = payload.Variations;
        DisabledVariationId = payload.DisabledVariationId;
        EnabledVariationId = payload.EnabledVariationId;
        Tags = payload.Tags;
        InsightsEnabled = payload.InsightsEnabled;
    }
}

public class CreateFeatureFlagValidator : AbstractValidator<CreateFeatureFlag>
{
    public CreateFeatureFlagValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"))
            .MaximumLength(128).WithErrorCode(ErrorCodes.Invalid("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"))
            .MaximumLength(128).WithErrorCode(ErrorCodes.Invalid("key"))
            .Matches(FeatureFlag.KeyPattern).WithErrorCode(ErrorCodes.Invalid("key"));

        RuleFor(x => x.VariationType)
            .Must(VariationTypes.IsDefined).WithErrorCode(ErrorCodes.Invalid("variationType"));

        RuleFor(x => x.Variations)
            .NotEmpty()
            .Must(variations => variations.All(variation => variation.IsValid()))
            .WithErrorCode(ErrorCodes.Invalid("variations"));

        RuleFor(x => x.DisabledVariationId)
            .Must((flag, variationId) => flag.Variations?.Any(x => x.Id == variationId) ?? false)
            .WithErrorCode(ErrorCodes.Invalid("disabledVariationId"));

        RuleFor(x => x.EnabledVariationId)
            .Must((flag, variationId) => flag.Variations?.Any(x => x.Id == variationId) ?? false)
            .WithErrorCode(ErrorCodes.Invalid("enabledVariationId"));
    }
}

public class CreateFeatureFlagHandler(
    IFeatureFlagService service,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<CreateFeatureFlag, FeatureFlag>
{
    public async Task<FeatureFlag> Handle(CreateFeatureFlag request, CancellationToken cancellationToken)
    {
        var hasKeyBeenUsed = await service.HasKeyBeenUsedAsync(request.EnvId, request.Key);
        if (hasKeyBeenUsed)
        {
            throw new BusinessException(ErrorCodes.KeyHasBeenUsed);
        }

        var flag = request.AsFeatureFlag(currentUser.Id);
        await service.AddOneAsync(flag);

        // publish on feature flag change notification
        var dataChange = new DataChange(null).To(flag);
        var notification = new OnFeatureFlagChanged(flag, request.WorkspaceId, request.OrgId, Operations.Create, dataChange, currentUser.Id);
        await publisher.Publish(notification, cancellationToken);

        return flag;
    }
}
