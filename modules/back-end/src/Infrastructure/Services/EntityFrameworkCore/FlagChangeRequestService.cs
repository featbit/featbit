using Application.ChangeRequests;
using Application.Bases.Exceptions;
using Domain.FlagChangeRequests;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class FlagChangeRequestService(AppDbContext dbContext)
    : EntityFrameworkCoreService<FlagChangeRequest>(dbContext), IFlagChangeRequestService
{
    public override async Task UpdateAsync(FlagChangeRequest value)
    {
        var query = Set.Where(x => x.Id == value.Id && x.OrgId == value.OrgId && x.EnvId == value.EnvId);
        int changed;
        if (value.Status == FlagChangeRequestStatus.PendingReview && value.ScheduleId.HasValue)
        {
            // Linking a schedule must not replace a concurrently saved decision.
            changed = await query.Where(x => x.ScheduleId == null || x.ScheduleId == value.ScheduleId)
                .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.ScheduleId, value.ScheduleId));
        }
        else
        {
            if (value.Status is not (FlagChangeRequestStatus.Approved or FlagChangeRequestStatus.Declined or FlagChangeRequestStatus.Applied))
                throw new ConflictException(nameof(FlagChangeRequest), value.Id);
            var expected = value.Status == FlagChangeRequestStatus.Applied
                ? FlagChangeRequestStatus.Approved : FlagChangeRequestStatus.PendingReview;
            changed = await query.Where(x => x.Status == expected).ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Status, value.Status).SetProperty(x => x.Reviewers, value.Reviewers)
                .SetProperty(x => x.UpdatedAt, value.UpdatedAt).SetProperty(x => x.UpdatorId, value.UpdatorId));
        }

        if (changed == 0) throw new ConflictException(nameof(FlagChangeRequest), value.Id);
    }

    public async Task<FlagChangeRequestPage> GetListAsync(
        Guid orgId,
        Guid envId,
        Guid currentUserId,
        ChangeRequestFilter filter)
    {
        var query = Queryable.Where(item => item.OrgId == orgId && item.EnvId == envId);
        var search = filter.Query?.Trim().ToLower();

        if (filter.Id.HasValue)
        {
            query = query.Where(item => item.Id == filter.Id.Value);
        }

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
