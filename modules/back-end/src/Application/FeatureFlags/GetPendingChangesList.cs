using Domain.FlagSchedules;
using Domain.SemanticPatch;

namespace Application.FeatureFlags;

public class GetPendingChangesList : IRequest<ICollection<PendingChangesVm>>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }
}

public class GetPendingChangesListHandler : IRequestHandler<GetPendingChangesList, ICollection<PendingChangesVm>>
{
    private readonly IFlagScheduleService _flagScheduleService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly IUserService _userService;
    private readonly IFeatureFlagService _flagService;

    public GetPendingChangesListHandler(
        IFlagScheduleService flagScheduleService,
        IFlagDraftService flagDraftService,
        IUserService userService,
        IFeatureFlagService flagService)
    {
        _flagScheduleService = flagScheduleService;
        _flagDraftService = flagDraftService;
        _userService = userService;
        _flagService = flagService;
    }

    public async Task<ICollection<PendingChangesVm>> Handle(GetPendingChangesList request, CancellationToken cancellationToken)
    {
        var flag = await _flagService.GetAsync(request.EnvId, request.Key);

        var pendingSchedules =
            await _flagScheduleService.FindManyAsync(x => x.FlagId == flag.Id && x.Status == FlagScheduleStatus.Pending);
        var drafts =
            await _flagDraftService.FindManyAsync(x => pendingSchedules.Select(s => s.FlagDraftId).Contains(x.Id));
        var users = await _userService.GetListAsync(pendingSchedules.Select(x => x.CreatorId));

        var result = new List<PendingChangesVm>();

        foreach (var schedule in pendingSchedules)
        {
            var vm = new PendingChangesVm
            {
                Id = schedule.Id,
                FlagId = schedule.FlagId,
                CreatedAt = schedule.CreatedAt,
                ScheduledTime = schedule.ScheduledTime
            };

            var draft = drafts.FirstOrDefault(x => x.Id == schedule.FlagDraftId);
            if (draft != null)
            {
                vm.DataChange = draft.DataChange;
                vm.Instructions = FlagComparer.Compare(draft.DataChange);
            }

            var user = users.FirstOrDefault(x => x.Id == schedule.CreatorId);
            if (user == null)
            {
                continue;
            }

            vm.CreatorId = user.Id;
            vm.CreatorName = user.Name;

            result.Add(vm);
        }

        return result.OrderByDescending(x => x.ScheduledTime).ToArray();
    }
}