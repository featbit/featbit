using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Application.Bases.Exceptions;

namespace Application.FeatureFlags;

public class CreateFeatureFlag : IRequest<FeatureFlag>
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public bool IsEnabled { get; set; }

    public string Description { get; set; }

    public string VariationType { get; set; }

    public ICollection<Variation> Variations { get; set; }

    public string EnabledVariationId { get; set; }

    public string DisabledVariationId { get; set; }

    public ICollection<string> Tags { get; set; }

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
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.KeyIsRequired);

        RuleFor(x => x.VariationType)
            .Must(VariationTypes.IsDefined).WithErrorCode(ErrorCodes.InvalidVariationType);

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
    private readonly IAuditLogService _auditLogService;

    public CreateFeatureFlagHandler(
        IFeatureFlagService service,
        ICurrentUser currentUser,
        IPublisher publisher,
        IAuditLogService auditLogService)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
        _auditLogService = auditLogService;
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

        // write audit log
        var auditLog = AuditLog.ForCreate(flag, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        // publish on feature flag change notification
        await _publisher.Publish(new OnFeatureFlagChanged(flag), cancellationToken);

        return flag;
    }
}