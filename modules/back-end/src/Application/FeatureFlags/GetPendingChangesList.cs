using Domain.FlagChangeRequests;
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
    private readonly IFlagChangeRequestService _flagChangeRequestService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly IUserService _userService;
    private readonly IFeatureFlagService _flagService;

    public GetPendingChangesListHandler(
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

    public async Task<ICollection<PendingChangesVm>> Handle(GetPendingChangesList request, CancellationToken cancellationToken)
    {
        var flag = await _flagService.GetAsync(request.EnvId, request.Key);

        var pendingSchedules =
            await _flagScheduleService.FindManyAsync(x => x.FlagId == flag.Id && x.Status != FlagScheduleStatus.Applied);
        
        var pendingChangeRequests = await _flagChangeRequestService.FindManyAsync(x => x.FlagId == flag.Id && x.Status != FlagChangeRequestStatus.Applied);
        
        var drafts =
            await _flagDraftService.FindManyAsync(x => pendingSchedules.Select(s => s.FlagDraftId).Union(pendingChangeRequests.Select(cr => cr.FlagDraftId)).Contains(x.Id));
        
        var users = await _userService.GetListAsync(pendingSchedules.Select(x => x.CreatorId).Union(pendingChangeRequests.Select(cr => cr.CreatorId)));

        var result = new List<PendingChangesVm>();
        
        foreach (var schedule in pendingSchedules)
        {
            var vm = new PendingChangesVm
            {
                Type = PendingChangeType.Schedule,
                Id = schedule.Id,
                FlagId = schedule.FlagId,
                CreatedAt = schedule.CreatedAt,
                Status = schedule.Status,
                ScheduleTitle = schedule.Title,
                ScheduledTime = schedule.ScheduledTime,
                ChangeRequestId = schedule.ChangeRequestId
            };
            
            var changeRequest = pendingChangeRequests.FirstOrDefault(cr => cr.Id == schedule.ChangeRequestId);
            if (changeRequest != null)
            {
                vm.ChangeRequestReason = changeRequest.Reason;
                vm.Reviewers = changeRequest.Reviewers;
            }

            vm = PostProcess(vm, schedule.FlagDraftId, schedule.CreatorId);
            if (vm == null)
            {
                continue;
            }
            
            result.Add(vm);
        }
        
        var attachedChangeRequestIds =
            pendingSchedules.Where(s => s.ChangeRequestId != null).Select(s => s.ChangeRequestId);
        var changeRequestsSolo = pendingChangeRequests.Where(cr => !attachedChangeRequestIds.Contains(cr.Id));

        foreach (var changeRequest in changeRequestsSolo)
        {
            var vm = new PendingChangesVm
            {
                Type = PendingChangeType.ChangeRequest,
                Id = changeRequest.Id,
                FlagId = changeRequest.FlagId,
                CreatedAt = changeRequest.CreatedAt,
                Status = changeRequest.Status,
                ChangeRequestReason = changeRequest.Reason,
                Reviewers = changeRequest.Reviewers
            };
            
            vm = PostProcess(vm, changeRequest.FlagDraftId, changeRequest.CreatorId);
            if (vm == null)
            {
                continue;
            }
            
            result.Add(vm);
        }

        return result.OrderByDescending(x => x.CreatedAt).ToArray();

        // set instructions and creator
        PendingChangesVm PostProcess(PendingChangesVm vm, Guid flagDraftId, Guid creatorId)
        {
            var draft = drafts.FirstOrDefault(x => x.Id == flagDraftId);
            if (draft != null)
            {
                vm.DataChange = draft.DataChange;
                vm.Instructions = FlagComparer.Compare(draft.DataChange);
            }

            var user = users.FirstOrDefault(x => x.Id == creatorId);
            if (user == null)
            {
                return null;
            }

            vm.CreatorId = user.Id;
            vm.CreatorName = user.Name;
            
            return vm;
        }
    }
}