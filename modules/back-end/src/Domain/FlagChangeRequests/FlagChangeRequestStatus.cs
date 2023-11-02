namespace Domain.FlagChangeRequests;

public class FlagChangeRequestStatus
{
    public const string PendingReview = nameof(PendingReview);

    public const string Approved = nameof(Approved);

    public const string Declined = nameof(Declined);

    public const string Applied = nameof(Applied);

    public static readonly string[] All = { PendingReview, Approved, Declined, Applied };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}