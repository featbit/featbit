using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.Workspaces;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;
using Domain.FlagSchedules;

namespace Application.FeatureFlags;

public class CreateFlagSchedule : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Revision { get; set; }

    public string Key { get; set; }

    public FlagTargeting Targeting { get; set; }

    public string Title { get; set; }

    public DateTime ScheduledTime { get; set; }

    public bool WithChangeRequest { get; set; }

    public string Reason { get; set; }

    public ICollection<Guid> Reviewers { get; set; }
}

public class CreateFlagScheduleHandler : IRequestHandler<CreateFlagSchedule, bool>
{
    private readonly IFeatureFlagService _flagService;
    private readonly ILicenseService _licenseService;
    private readonly IFlagScheduleService _flagScheduleService;
    private readonly IFlagChangeRequestService _flagChangeRequestService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly ICurrentUser _currentUser;

    public CreateFlagScheduleHandler(
        IFeatureFlagService flagService,
        ILicenseService licenseService,
        IFlagScheduleService flagScheduleService,
        IFlagChangeRequestService flagChangeRequestService,
        IFlagDraftService flagDraftService,
        ICurrentUser currentUser)
    {
        _flagService = flagService;
        _licenseService = licenseService;
        _flagScheduleService = flagScheduleService;
        _flagChangeRequestService = flagChangeRequestService;
        _flagDraftService = flagDraftService;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(CreateFlagSchedule request, CancellationToken cancellationToken)
    {
        var flag = await _flagService.GetAsync(request.EnvId, request.Key);
        if (!flag.Revision.Equals(request.Revision))
        {
            throw new ConflictException(nameof(FeatureFlag), flag.Id);
        }

        var dataChange = flag.UpdateTargeting(request.Targeting, _currentUser.Id);

        // create draft
        var flagDraft = new FlagDraft(request.EnvId, flag.Id, dataChange, _currentUser.Id);
        await _flagDraftService.AddOneAsync(flagDraft);

        // create change request if needed
        var changeRequest = request.WithChangeRequest ? await CreateChangeRequest() : null;

        // create schedule and link to change request
        var schedule = await CreateSchedule(changeRequest?.Id);

        // link schedule to change request if needed
        if (changeRequest != null)
        {
            changeRequest.AttachSchedule(schedule.Id);
            await _flagChangeRequestService.UpdateAsync(changeRequest);
        }

        return true;

        async Task<FlagSchedule> CreateSchedule(Guid? changeRequestId)
        {
            var status = changeRequestId.HasValue
                ? FlagScheduleStatus.PendingReview
                : FlagScheduleStatus.PendingExecution;

            var newSchedule = new FlagSchedule(
                request.OrgId,
                request.EnvId,
                flagDraft.Id,
                flag.Id,
                status,
                request.Title,
                request.ScheduledTime,
                _currentUser.Id,
                changeRequestId
            );
            await _flagScheduleService.AddOneAsync(newSchedule);

            return newSchedule;
        }

        async Task<FlagChangeRequest> CreateChangeRequest()
        {
            // check license
            var isChangeRequestGranted =
                await _licenseService.IsFeatureGrantedAsync(request.WorkspaceId, LicenseFeatures.ChangeRequest);
            if (!isChangeRequestGranted)
            {
                throw new BusinessException(ErrorCodes.Unauthorized);
            }

            // create change request
            var newChangeRequest = new FlagChangeRequest(
                request.OrgId,
                request.EnvId,
                flagDraft.Id,
                flag.Id,
                request.Reviewers,
                _currentUser.Id,
                reason: request.Reason
            );
            await _flagChangeRequestService.AddOneAsync(newChangeRequest);

            return newChangeRequest;
        }
    }
}