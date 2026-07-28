using Application.ChangeRequests;
using Domain.FlagChangeRequests;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class FlagChangeRequestService(AppDbContext dbContext)
    : EntityFrameworkCoreService<FlagChangeRequest>(dbContext), IFlagChangeRequestService
{
    public async Task<FlagChangeRequestPage> GetListAsync(
        Guid orgId,
        Guid envId,
        Guid currentUserId,
        ChangeRequestFilter filter)
    {
        var query = Queryable.Where(item => item.OrgId == orgId && item.EnvId == envId);
        var search = filter.Query?.Trim().ToLower();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(item => item.Reason != null && item.Reason.ToLower().Contains(search));
        }

        if (filter.CreatorId.HasValue)
        {
            query = query.Where(item => item.CreatorId == filter.CreatorId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            query = query.Where(item => item.Status == filter.Status);
        }

        // Reviewers are stored as JSON. Apply that filter and the reviewer-priority sort
        // after the database has narrowed the environment, comment, creator and status.
        var candidates = await query.ToListAsync();
        var filtered = filter.ReviewerId.HasValue
            ? candidates.Where(item => item.Reviewers.Any(reviewer => reviewer.MemberId == filter.ReviewerId.Value))
            : candidates;
        var items = filtered.ToArray();
        var needsReviewCount = items.LongCount(item =>
            item.Status == FlagChangeRequestStatus.PendingReview &&
            item.Reviewers.Any(reviewer => reviewer.MemberId == currentUserId));
        var pageIndex = Math.Max(0, filter.PageIndex);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var pageItems = items
            .OrderByDescending(item =>
                item.Status == FlagChangeRequestStatus.PendingReview &&
                item.Reviewers.Any(reviewer => reviewer.MemberId == currentUserId))
            .ThenByDescending(item => item.UpdatedAt)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToArray();

        return new FlagChangeRequestPage(items.LongLength, needsReviewCount, pageItems);
    }
}
