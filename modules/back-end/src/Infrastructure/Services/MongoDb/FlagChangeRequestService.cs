using Application.ChangeRequests;
using Application.Bases.Exceptions;
using Domain.FlagChangeRequests;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class FlagChangeRequestService(MongoDbClient mongoDb)
    : MongoDbService<FlagChangeRequest>(mongoDb), IFlagChangeRequestService
{
    public override async Task UpdateAsync(FlagChangeRequest value)
    {
        var filters = Builders<FlagChangeRequest>.Filter;
        var filter = filters.Eq(x => x.Id, value.Id) & filters.Eq(x => x.OrgId, value.OrgId) &
                     filters.Eq(x => x.EnvId, value.EnvId);
        var updates = Builders<FlagChangeRequest>.Update;
        UpdateDefinition<FlagChangeRequest> update;
        if (value.Status == FlagChangeRequestStatus.PendingReview && value.ScheduleId.HasValue)
        {
            // Linking a schedule must not replace a review decision saved since this object was read.
            filter &= filters.Or(filters.Eq(x => x.ScheduleId, null), filters.Eq(x => x.ScheduleId, value.ScheduleId));
            update = updates.Set(x => x.ScheduleId, value.ScheduleId);
        }
        else
        {
            if (value.Status is not (FlagChangeRequestStatus.Approved or FlagChangeRequestStatus.Declined or FlagChangeRequestStatus.Applied))
                throw new ConflictException(nameof(FlagChangeRequest), value.Id);
            filter &= filters.Eq(x => x.Status, value.Status == FlagChangeRequestStatus.Applied
                ? FlagChangeRequestStatus.Approved : FlagChangeRequestStatus.PendingReview);
            update = updates.Set(x => x.Status, value.Status).Set(x => x.Reviewers, value.Reviewers)
                .Set(x => x.UpdatedAt, value.UpdatedAt).Set(x => x.UpdatorId, value.UpdatorId);
        }

        var result = await Collection.UpdateOneAsync(filter, update);
        if (result.MatchedCount == 0) throw new ConflictException(nameof(FlagChangeRequest), value.Id);
    }

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
            item.Reviewers.Any(reviewer => reviewer.MemberId == currentUserId)
        );
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
