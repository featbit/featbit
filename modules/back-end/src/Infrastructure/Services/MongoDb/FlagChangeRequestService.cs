using Application.ChangeRequests;
using Domain.FlagChangeRequests;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class FlagChangeRequestService(MongoDbClient mongoDb)
    : MongoDbService<FlagChangeRequest>(mongoDb), IFlagChangeRequestService
{
    public async Task<FlagChangeRequestPage> GetListAsync(
        Guid orgId,
        Guid envId,
        Guid currentUserId,
        ChangeRequestFilter filter)
    {
        var query = Queryable.Where(item => item.OrgId == orgId && item.EnvId == envId);
        var search = filter.Query?.Trim();

        if (filter.Id.HasValue)
        {
            query = query.Where(item => item.Id == filter.Id.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(item =>
                item.Reason != null &&
                item.Reason.Contains(search, StringComparison.CurrentCultureIgnoreCase));
        }

        if (filter.CreatorId.HasValue)
        {
            query = query.Where(item => item.CreatorId == filter.CreatorId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            query = query.Where(item => item.Status == filter.Status);
        }

        // Reviewers are embedded documents. Keep the same ordering semantics as the
        // relational implementation after applying the scalar filters in MongoDB.
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
