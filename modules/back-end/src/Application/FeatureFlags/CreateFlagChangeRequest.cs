using Application.Bases.Exceptions;
using Application.Users;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;

namespace Application.FeatureFlags;

public class CreateFlagChangeRequest : IRequest<bool>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Revision { get; set; }

    public string Key { get; set; }

    public FlagTargeting Targeting { get; set; }

    public string Reason { get; set; }

    public ICollection<Guid> Reviewers { get; set; }
}

public class CreateFlagChangeRequestHandler : IRequestHandler<CreateFlagChangeRequest, bool>
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

    public async Task<bool> Handle(CreateFlagChangeRequest request, CancellationToken cancellationToken)
    {
        var flag = await _flagService.GetAsync(request.EnvId, request.Key);
        if (!flag.Revision.Equals(request.Revision))
        {
            throw new ConflictException(nameof(FeatureFlag), flag.Id);
        }

        // create flag draft
        var dataChange = flag.UpdateTargeting(request.Targeting, _currentUser.Id);
        var flagDraft = new FlagDraft(request.EnvId, flag.Id, dataChange, _currentUser.Id, comment: request.Reason);
        await _flagDraftService.AddOneAsync(flagDraft);

        // create change request
        var flagChangeRequest = new FlagChangeRequest(
            request.OrgId,
            request.EnvId,
            flagDraft.Id,
            flag.Id,
            request.Reviewers,
            _currentUser.Id,
            reason: request.Reason
        );
        await _flagChangeRequestService.AddOneAsync(flagChangeRequest);

        return true;
    }
}