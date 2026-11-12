using Domain.FeatureFlags;
using Application.Bases;
using Domain.Resources;
using Domain.Policies;

namespace Application.FeatureFlags;

public class CopyToEnvPrecheck : IRequest<ICollection<CopyToEnvPrecheckResult>>
{
    public Guid OrgId { get; set; }

    public Guid SourceEnvId { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];

    public Guid TargetEnvId { get; set; }

    public ICollection<Guid> FlagIds { get; set; } = Array.Empty<Guid>();
}

public class CopyToEnvPrecheckValidator : AbstractValidator<CopyToEnvPrecheck>
{
    public CopyToEnvPrecheckValidator()
    {
        RuleFor(x => x.FlagIds).NotEmpty().WithErrorCode(ErrorCodes.Invalid("flagIds"));
        RuleFor(x => x.SourceEnvId).NotEmpty().WithErrorCode(ErrorCodes.Invalid("sourceEnvId"));
        RuleFor(x => x.TargetEnvId)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("targetEnvId"))
            .NotEqual(x => x.SourceEnvId)
            .WithErrorCode(ErrorCodes.Invalid("targetEnvId"));
    }
}

public class CopyToEnvPrecheckHandler(
    FlagAccessGuard flagAccessGuard,
    FlagCopyPrecheck precheck)
    : IRequestHandler<CopyToEnvPrecheck, ICollection<CopyToEnvPrecheckResult>>
{
    public async Task<ICollection<CopyToEnvPrecheckResult>> Handle(
        CopyToEnvPrecheck request,
        CancellationToken cancellationToken)
    {
        var flags = await flagAccessGuard.GetAuthorizedFlagsForCopyAsync(request.OrgId, request.SourceEnvId,
            request.TargetEnvId, request.FlagIds, request.Permissions);
        return await precheck.CheckAsync(flags, request.TargetEnvId);
    }
}
