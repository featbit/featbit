using Domain.FlagChangeRequests;

namespace Application.ChangeRequests;

public class FlagChangeRequestPage
{
    public long TotalCount { get; }

    public long NeedsReviewCount { get; }

    public IReadOnlyList<FlagChangeRequest> Items { get; }

    public FlagChangeRequestPage(
        long totalCount,
        long needsReviewCount,
        IReadOnlyList<FlagChangeRequest> items)
    {
        TotalCount = totalCount;
        NeedsReviewCount = needsReviewCount;
        Items = items;
    }
}
