namespace Domain.FlagSchedules;

public class FlagScheduleStatus
{
    public const string PendingReview = nameof(PendingReview);

    public const string PendingExecution = nameof(PendingExecution);

    public const string Applied = nameof(Applied);

    public static readonly string[] All = { PendingReview, PendingExecution, Applied };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}