using Application.Bases.Exceptions;
using Application.Bases;
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

public class CreateFlagChangeRequestValidator : AbstractValidator<CreateFlagChangeRequest>
{
    public CreateFlagChangeRequestValidator()
    {
        RuleFor(x => x.Targeting)
            .NotNull().WithErrorCode(ErrorCodes.Required("targeting"));
    }
}

public class CreateFlagChangeRequestHandler(
    IFeatureFlagService flagService,
    IFlagChangeRequestService flagChangeRequestService,
    IFlagDraftService flagDraftService,
    ICurrentUser currentUser)
    : IRequestHandler<CreateFlagChangeRequest, bool>
{
    public async Task<bool> Handle(CreateFlagChangeRequest request, CancellationToken cancellationToken)
    {
        var flag = await flagService.GetAsync(request.EnvId, request.Key);
        if (!flag.Revision.Equals(request.Revision))
        {
            throw new ConflictException(nameof(FeatureFlag), flag.Id);
        }

        FlagTargetingValidator.EnsureValid(request.Targeting, flag.Variations);

        // create flag draft
        var dataChange = flag.UpdateTargeting(request.Targeting, currentUser.Id);
        var flagDraft = new FlagDraft(request.EnvId, flag.Id, dataChange, currentUser.Id, comment: request.Reason);
        await flagDraftService.AddOneAsync(flagDraft);

        // create change request
        var flagChangeRequest = new FlagChangeRequest(
            request.OrgId,
            request.EnvId,
            flagDraft.Id,
            flag.Id,
            request.Reviewers,
            currentUser.Id,
            reason: request.Reason
        );
        await flagChangeRequestService.AddOneAsync(flagChangeRequest);

        return true;
    }
}
