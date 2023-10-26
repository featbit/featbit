using Application.Users;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;

namespace Application.FeatureFlags;

public class CreateFlagChangeRequest : IRequest<Guid>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public string Key { get; set; }
    
    public FlagTargeting Targeting { get; set; }

    public string Reason { get; set; }

    public ICollection<Guid> Reviewers { get; set; }
}

public class CreateFlagChangeRequestHandler : IRequestHandler<CreateFlagChangeRequest, Guid>
{
    private readonly IFeatureFlagService _flagService;
    private readonly IFlagChangeRequestService _flagChangeRequestService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly ICurrentUser _currentUser;

    public CreateFlagChangeRequestHandler(
        IFeatureFlagService flagService,
        IFlagChangeRequestService flagChangeRequestService,
        IFlagDraftService flagDraftService,
        ICurrentUser currentUser)
    {
        _flagService = flagService;
        _flagChangeRequestService = flagChangeRequestService;
        _flagDraftService = flagDraftService;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(CreateFlagChangeRequest request, CancellationToken cancellationToken)
    {
        var flag = await _flagService.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.UpdateTargeting(
            request.Targeting.TargetUsers,
            request.Targeting.Rules,
            request.Targeting.Fallthrough,
            request.Targeting.ExptIncludeAllTargets,
            _currentUser.Id
        );

        var flagDraft = FlagDraft.Pending(request.EnvId, flag.Id, request.Reason, dataChange, _currentUser.Id);
        await _flagDraftService.AddOneAsync(flagDraft);

        // create change request
        var flagChangeRequest = FlagChangeRequest.Pending(
            request.OrgId,
            request.EnvId,
            flagDraft.Id,
            flag.Id,
            request.Reason,
            request.Reviewers, 
            _currentUser.Id
        );
        
        await _flagChangeRequestService.AddOneAsync(flagChangeRequest);

        return flagChangeRequest.Id;
    }
}