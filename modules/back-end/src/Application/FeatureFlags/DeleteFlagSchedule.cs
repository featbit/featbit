using Application.Bases.Exceptions;
using Domain.Policies;
using System.Text.Json.Serialization;

namespace Application.FeatureFlags;

public class DeleteFlagSchedule : IRequest<bool>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    [JsonIgnore]
    public PolicyStatement[] Permissions { get; set; } = [];

    public Guid Id { get; set; }
}

public class DeleteFlagScheduleHandler(
    IFlagScheduleService service,
    IFeatureFlagService flagService,
    IFlagDraftService draftService,
    IPermissionGuard permissionGuard) : IRequestHandler<DeleteFlagSchedule, bool>
{
    public async Task<bool> Handle(DeleteFlagSchedule request, CancellationToken cancellationToken)
    {
        var schedule = await service.FindOneAsync(x =>
            x.Id == request.Id && x.OrgId == request.OrgId && x.EnvId == request.EnvId);
        if (schedule == null) throw new ForbiddenException();

        var flag = await flagService.FindOneAsync(x => x.Id == schedule.FlagId && x.EnvId == request.EnvId);
        if (flag == null) throw new ForbiddenException();

        var draft = await draftService.FindOneAsync(x =>
            x.Id == schedule.FlagDraftId && x.FlagId == flag.Id && x.EnvId == request.EnvId);
        if (draft == null) throw new ForbiddenException();

        await permissionGuard.EnsureFlagChangeAllowedAsync(request.OrgId, flag, draft.DataChange, request.Permissions);
        await service.DeleteAsync(schedule.Id);

        return true;
    }
}
