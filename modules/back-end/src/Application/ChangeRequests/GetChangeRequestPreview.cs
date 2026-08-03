using Application.Bases.Exceptions;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;

namespace Application.ChangeRequests;

public class GetChangeRequestPreview : IRequest<ChangeRequestPreviewVm>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetChangeRequestPreviewHandler(
    IFlagChangeRequestService changeRequestService,
    IFlagDraftService flagDraftService,
    IFeatureFlagService flagService)
    : IRequestHandler<GetChangeRequestPreview, ChangeRequestPreviewVm>
{
    public async Task<ChangeRequestPreviewVm> Handle(
        GetChangeRequestPreview request,
        CancellationToken cancellationToken)
    {
        var changeRequest = await changeRequestService.FindOneAsync(item =>
            item.Id == request.Id && item.OrgId == request.OrgId && item.EnvId == request.EnvId);
        if (changeRequest == null)
        {
            throw new EntityNotFoundException(nameof(FlagChangeRequest), request.Id.ToString());
        }

        var draft = await flagDraftService.FindOneAsync(item =>
            item.Id == changeRequest.FlagDraftId && item.EnvId == request.EnvId);
        if (draft == null)
        {
            throw new EntityNotFoundException("FlagDraft", changeRequest.FlagDraftId.ToString());
        }

        var currentFlag = await flagService.FindOneAsync(item =>
            item.Id == changeRequest.FlagId && item.EnvId == request.EnvId);
        if (currentFlag == null)
        {
            throw new EntityNotFoundException(nameof(FeatureFlag), changeRequest.FlagId.ToString());
        }

        var previewFlag = currentFlag.Clone();
        if (changeRequest.Status != FlagChangeRequestStatus.Applied)
        {
            previewFlag.ApplyDraft(draft);
        }

        return new ChangeRequestPreviewVm
        {
            Id = changeRequest.Id,
            Reason = changeRequest.Reason,
            Status = changeRequest.Status,
            Flag = previewFlag
        };
    }
}
