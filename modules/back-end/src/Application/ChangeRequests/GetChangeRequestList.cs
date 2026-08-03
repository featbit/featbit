using Application.Bases.Exceptions;
using Application.Users;
using Domain.FeatureFlags;
using Domain.FlagDrafts;
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
    IResourceService resourceService,
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
            request.Filter
        );

        var flagIds = page.Items.Select(item => item.FlagId).Distinct().ToArray();
        var draftIds = page.Items.Select(item => item.FlagDraftId).Distinct().ToArray();
        var userIds = page.Items
            .SelectMany(item => new[] { item.CreatorId, item.UpdatorId })
            .Distinct()
            .ToArray();
        var reviewerIds = page.Items
            .SelectMany(item => item.Reviewers)
            .Select(reviewer => reviewer.MemberId)
            .Distinct()
            .ToArray();
        var environmentIds = page.Items
            .Select(item => item.EnvId)
            .Distinct()
            .ToArray();

        var flags = flagIds.Length == 0
            ? Array.Empty<FeatureFlag>()
            : await flagService.FindManyAsync(flag => flagIds.Contains(flag.Id));
        var drafts = draftIds.Length == 0
            ? Array.Empty<FlagDraft>()
            : await flagDraftService.FindManyAsync(draft => draftIds.Contains(draft.Id));
        var users = userIds.Length == 0
            ? Array.Empty<User>()
            : await userService.GetListAsync(userIds);
        var environmentRns = new Dictionary<Guid, string>();
        foreach (var environmentId in environmentIds)
        {
            environmentRns[environmentId] =
                await resourceService.GetEnvRnAsync(environmentId) ?? string.Empty;
        }

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
            var creator = users.FirstOrDefault(item => item.Id == changeRequest.CreatorId);
            var updator = users.FirstOrDefault(item => item.Id == changeRequest.UpdatorId);
            var scopeRn = environmentRns.GetValueOrDefault(changeRequest.EnvId, string.Empty);
            return new ChangeRequestVm(
                changeRequest,
                flag,
                draft,
                creator,
                updator,
                reviewerMembers,
                scopeRn,
                currentUser.Id
            );
        }).ToArray();

        return new ChangeRequestListVm(page.TotalCount, page.NeedsReviewCount, items);
    }
}
