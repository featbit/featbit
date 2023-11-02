using Domain.FlagChangeRequests;
using Domain.FlagSchedules;
using Domain.SemanticPatch;

namespace Application.FeatureFlags;

public class GetPendingChanges : IRequest<IEnumerable<PendingChangesVm>>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }
}

public class GetPendingChangesHandler : IRequestHandler<GetPendingChanges, IEnumerable<PendingChangesVm>>
{
    private readonly IFlagScheduleService _flagScheduleService;
    private readonly IFlagChangeRequestService _flagChangeRequestService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly IUserService _userService;
    private readonly IFeatureFlagService _flagService;

    public GetPendingChangesHandler(
        IFlagScheduleService flagScheduleService,
        IFlagChangeRequestService flagChangeRequestService,
        IFlagDraftService flagDraftService,
        IUserService userService,
        IFeatureFlagService flagService)
    {
        _flagScheduleService = flagScheduleService;
        _flagChangeRequestService = flagChangeRequestService;
        _flagDraftService = flagDraftService;
        _userService = userService;
        _flagService = flagService;
    }

    public async Task<IEnumerable<PendingChangesVm>> Handle(GetPendingChanges request, CancellationToken cancellationToken)
    {
        var flag = await _flagService.GetAsync(request.EnvId, request.Key);

        // get schedules
        var pendingSchedules = await _flagScheduleService.FindManyAsync(
            x => x.FlagId == flag.Id && x.Status != FlagScheduleStatus.Applied
        );

        // get change requests
        var pendingChangeRequests = await _flagChangeRequestService.FindManyAsync(
            x => x.FlagId == flag.Id && x.Status != FlagChangeRequestStatus.Applied
        );

        // get drafts
        var draftIds =
            pendingSchedules.Select(s => s.FlagDraftId).Union(pendingChangeRequests.Select(cr => cr.FlagDraftId));
        var drafts = await _flagDraftService.FindManyAsync(x => draftIds.Contains(x.Id));

        // get users
        var userIds =
            pendingSchedules.Select(x => x.CreatorId).Union(pendingChangeRequests.Select(cr => cr.CreatorId));
        var users = await _userService.GetListAsync(userIds);

        var result = new List<PendingChangesVm>();

        // handle pending schedules
        result.AddRange(
            from schedule in pendingSchedules
            let changeRequest = pendingChangeRequests.FirstOrDefault(cr => cr.Id == schedule.ChangeRequestId)
            let vm = new PendingChangesVm(schedule, changeRequest)
            select PostProcess(vm, schedule.FlagDraftId, schedule.CreatorId)
        );

        // handle change requests without schedule
        var changeRequestsWithoutSchedule = pendingChangeRequests.Where(cr => !cr.ScheduleId.HasValue);
        result.AddRange(
            from changeRequest in changeRequestsWithoutSchedule
            let vm = new PendingChangesVm(changeRequest)
            select PostProcess(vm, changeRequest.FlagDraftId, changeRequest.CreatorId)
        );

        return result.OrderByDescending(x => x.CreatedAt);

        PendingChangesVm PostProcess(PendingChangesVm vm, Guid flagDraftId, Guid creatorId)
        {
            var draft = drafts.FirstOrDefault(x => x.Id == flagDraftId);
            if (draft != null)
            {
                vm.DataChange = draft.DataChange;
                vm.Instructions = FlagComparer.Compare(draft.DataChange);
            }

            var user = users.FirstOrDefault(x => x.Id == creatorId);
            if (user != null)
            {
                vm.CreatorId = user.Id;
                vm.CreatorName = user.Name;
            }

            return vm;
        }
    }
}