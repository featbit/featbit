using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Application.Bases.Exceptions;

namespace Application.FeatureFlags;

public class CreateFeatureFlag : IRequest<FeatureFlag>
{
    /// <summary>
    /// The ID of the environment the feature flag belongs to. Retrieved from the URL path.
    /// </summary>
    public Guid EnvId { get; set; }

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
        );

        return flag;
    }
}

public class CreateFeatureFlagValidator : AbstractValidator<CreateFeatureFlag>
{
    public CreateFeatureFlagValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"))
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

public class CreateFeatureFlagHandler : IRequestHandler<CreateFeatureFlag, FeatureFlag>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public CreateFeatureFlagHandler(
        IFeatureFlagService service,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<FeatureFlag> Handle(CreateFeatureFlag request, CancellationToken cancellationToken)
    {
        var hasKeyBeenUsed = await _service.HasKeyBeenUsedAsync(request.EnvId, request.Key);
        if (hasKeyBeenUsed)
        {
            throw new BusinessException(ErrorCodes.KeyHasBeenUsed);
        }

        var flag = request.AsFeatureFlag(_currentUser.Id);
        await _service.AddOneAsync(flag);

        // publish on feature flag change notification
        var dataChange = new DataChange(null).To(flag);
        var notification = new OnFeatureFlagChanged(flag, Operations.Create, dataChange, _currentUser.Id);
        await _publisher.Publish(notification, cancellationToken);

        return flag;
    }
}