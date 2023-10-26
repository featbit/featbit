using Application.Users;
using Domain.FlagChangeRequests;

namespace Application.FeatureFlags;

public class DeclineFlagChangeRequest : IRequest<bool>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class DeclineFlagChangeRequestHandler : IRequestHandler<DeclineFlagChangeRequest, bool>
{
    private readonly IFlagChangeRequestService _flagChangeRequestService;
    private readonly ICurrentUser _currentUser;

    public DeclineFlagChangeRequestHandler(
        IFlagChangeRequestService flagChangeRequestService,
        ICurrentUser currentUser)
    {
        _flagChangeRequestService = flagChangeRequestService;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(DeclineFlagChangeRequest request, CancellationToken cancellationToken)
    {
        var changeRequest = await _flagChangeRequestService.FindOneAsync(x => x.OrgId == request.OrgId && x.EnvId == request.EnvId && x.Id == request.Id);

        if (changeRequest == null || !changeRequest.IsReviewer(_currentUser.Id) || changeRequest.Status == FlagChangeRequestStatus.Applied)
        {
            return false;
        }
        
        changeRequest.Decline(_currentUser.Id);
        
        await _flagChangeRequestService.UpdateAsync(changeRequest);

        return true;
    }
}