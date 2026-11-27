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

public class CopyToEnvPrecheckHandler(FlagCopyChecks copyChecks)
    : IRequestHandler<CopyToEnvPrecheck, ICollection<CopyToEnvPrecheckResult>>
{
    public async ValueTask<ICollection<CopyToEnvPrecheckResult>> Handle(
        CopyToEnvPrecheck request,
        CancellationToken cancellationToken)
    {
        var context = new CopyToEnvContext(
            request.OrgId, request.SourceEnvId, request.TargetEnvId, request.FlagIds, request.Permissions
        );

        var flags = await copyChecks.EnsureCopyAllowedAsync(context);
        if (flags.Count == 0)
        {
            return [];
        }

        var precheckResults = await copyChecks.CheckAsync(flags, request.TargetEnvId);
        return precheckResults;
    }
}
