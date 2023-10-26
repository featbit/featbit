using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;
using Domain.FlagSchedules;
using Domain.Organizations;

namespace Application.FeatureFlags;

public class CreateFlagSchedule: IRequest<bool>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

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
        var dataChange = flag.UpdateTargeting(
            request.Targeting.TargetUsers,
            request.Targeting.Rules,
            request.Targeting.Fallthrough,
            request.Targeting.ExptIncludeAllTargets,
            _currentUser.Id
        );

        // create draft
        var flagDraft = FlagDraft.Pending(request.EnvId, flag.Id, string.Empty, dataChange, _currentUser.Id);
        await _flagDraftService.AddOneAsync(flagDraft);

        FlagChangeRequest flagChangeRequest = null;
        
        if (request.WithChangeRequest)
        {
            var isChangeRequestGranted =
                await _licenseService.IsFeatureGrantedAsync(request.OrgId, LicenseFeatures.ChangeRequest);

            if (!isChangeRequestGranted)
            {
                throw new BusinessException(ErrorCodes.Unauthorized);
            }
            
            // create change request
            flagChangeRequest = FlagChangeRequest.PendingReview(
                request.OrgId,
                request.EnvId,
                flagDraft.Id,
                flag.Id,
                request.Reason,
                request.Reviewers, 
                _currentUser.Id
            );
            
            await _flagChangeRequestService.AddOneAsync(flagChangeRequest);
        }
        
        // create schedule
        FlagSchedule flagSchedule = null;
        
        if (flagChangeRequest != null)
        {
            flagSchedule = FlagSchedule.PendingReview(
                request.OrgId,
                request.EnvId,
                flagDraft.Id,
                flag.Id,
                request.Title,
                request.ScheduledTime,
                _currentUser.Id,
                flagChangeRequest.Id
            );
            
            await _flagScheduleService.AddOneAsync(flagSchedule);
            
            flagChangeRequest.SetScheduleId(flagSchedule.Id, _currentUser.Id);
            await _flagChangeRequestService.UpdateAsync(flagChangeRequest);
        }
        else
        {
            flagSchedule = FlagSchedule.PendingExecution(
                request.OrgId,
                request.EnvId,
                flagDraft.Id,
                flag.Id,
                request.Title,
                request.ScheduledTime,
                _currentUser.Id
            );
            
            await _flagScheduleService.AddOneAsync(flagSchedule);
        }
        
        return true;
    }
}