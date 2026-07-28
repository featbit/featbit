using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;
using Domain.SemanticPatch;
using Domain.Users;

namespace Application.ChangeRequests;

public class GetChangeRequestList : IRequest<ChangeRequestListVm>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public ChangeRequestFilter Filter { get; set; }
}

public class GetChangeRequestListHandler(
    IFlagChangeRequestService changeRequestService,
    IFlagDraftService flagDraftService,
    IFeatureFlagService flagService,
    IUserService userService,
    IMemberService memberService,
    ICurrentUser currentUser)
    : IRequestHandler<GetChangeRequestList, ChangeRequestListVm>
{
    public async Task<ChangeRequestListVm> Handle(
        GetChangeRequestList request,
        CancellationToken cancellationToken)
    {
        var page = await changeRequestService.GetListAsync(
            request.OrgId,
            request.EnvId,
            currentUser.Id,
            request.Filter);

        var flagIds = page.Items.Select(item => item.FlagId).Distinct().ToArray();
        var draftIds = page.Items.Select(item => item.FlagDraftId).Distinct().ToArray();
        var creatorIds = page.Items.Select(item => item.CreatorId).Distinct().ToArray();
        var reviewerIds = page.Items
            .SelectMany(item => item.Reviewers)
            .Select(reviewer => reviewer.MemberId)
            .Distinct()
            .ToArray();

        ICollection<FeatureFlag> flags = flagIds.Length == 0
            ? Array.Empty<FeatureFlag>()
            : await flagService.FindManyAsync(flag => flagIds.Contains(flag.Id));
        ICollection<FlagDraft> drafts = draftIds.Length == 0
            ? Array.Empty<FlagDraft>()
            : await flagDraftService.FindManyAsync(draft => draftIds.Contains(draft.Id));
        ICollection<User> creators = creatorIds.Length == 0
            ? Array.Empty<User>()
            : await userService.GetListAsync(creatorIds);
        var reviewerMembers = new Dictionary<Guid, (string Name, string Email)>();

        foreach (var reviewerId in reviewerIds)
        {
            try
            {
                var member = await memberService.GetAsync(request.OrgId, reviewerId);
                reviewerMembers[reviewerId] = (member.Name, member.Email);
            }
            catch (EntityNotFoundException)
            {
                // Preserve the reviewer id as a frontend fallback when a member no longer exists.
            }
        }

        var items = page.Items.Select(changeRequest =>
        {
            var flag = flags.FirstOrDefault(item => item.Id == changeRequest.FlagId);
            var draft = drafts.FirstOrDefault(item => item.Id == changeRequest.FlagDraftId);
            var creator = creators.FirstOrDefault(item => item.Id == changeRequest.CreatorId);

            return new ChangeRequestVm
            {
                Id = changeRequest.Id,
                FlagId = changeRequest.FlagId,
                FlagName = flag?.Name ?? string.Empty,
                FlagKey = flag?.Key ?? string.Empty,
                Reason = changeRequest.Reason,
                Status = changeRequest.Status,
                CreatorId = changeRequest.CreatorId,
                CreatorName = creator?.Name ?? string.Empty,
                CreatorEmail = creator?.Email ?? string.Empty,
                CreatedAt = changeRequest.CreatedAt,
                UpdatedAt = changeRequest.UpdatedAt,
                DataChange = draft?.DataChange ?? new DataChange(),
                Instructions = draft == null
                    ? Array.Empty<FlagInstruction>()
                    : FlagComparer.Compare(draft.DataChange),
                Reviewers = changeRequest.Reviewers.Select(reviewer =>
                {
                    reviewerMembers.TryGetValue(reviewer.MemberId, out var member);
                    return new ChangeRequestReviewerVm
                    {
                        MemberId = reviewer.MemberId,
                        Name = member.Name ?? string.Empty,
                        Email = member.Email ?? string.Empty,
                        Action = reviewer.Action,
                        Timestamp = reviewer.Timestamp
                    };
                }).ToArray(),
                CanReview = changeRequest.Status == FlagChangeRequestStatus.PendingReview &&
                            changeRequest.CanBeApprovedBy(currentUser.Id),
                CanApply = changeRequest.CanBeAppliedBy(currentUser.Id)
            };
        }).ToArray();

        return new ChangeRequestListVm
        {
            TotalCount = page.TotalCount,
            NeedsReviewCount = page.NeedsReviewCount,
            Items = items
        };
    }
}
