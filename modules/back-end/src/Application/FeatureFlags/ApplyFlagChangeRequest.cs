using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class ApplyFlagChangeRequest : IRequest<bool>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class ApplyFlagChangeRequestHandler : IRequestHandler<ApplyFlagChangeRequest, bool>
{
    private readonly IFlagChangeRequestService _flagChangeRequestService;
    private readonly IFeatureFlagAppService _featureFlagAppService;
    private readonly ICurrentUser _currentUser;

    public ApplyFlagChangeRequestHandler(
        IFlagChangeRequestService flagChangeRequestService,
        IFeatureFlagAppService featureFlagAppService,
        ICurrentUser currentUser)
    {
        _flagChangeRequestService = flagChangeRequestService;
        _featureFlagAppService = featureFlagAppService;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(ApplyFlagChangeRequest request, CancellationToken cancellationToken)
    {
        var changeRequest = await _flagChangeRequestService.FindOneAsync(
            x => x.OrgId == request.OrgId && x.EnvId == request.EnvId && x.Id == request.Id
        );

        // check if change request can be applied by current user
        if (changeRequest?.CanBeAppliedBy(_currentUser.Id) != true)
        {
            return false;
        }

        // apply flag draft
        await _featureFlagAppService.ApplyDraftAsync(
            changeRequest.FlagDraftId, Operations.ApplyFlagChangeRequest, _currentUser.Id
        );

        // update change request status
        changeRequest.Applied(_currentUser.Id);
        await _flagChangeRequestService.UpdateAsync(changeRequest);

        return true;
    }
}