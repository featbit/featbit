namespace Domain.FlagSchedules;

public class FlagScheduleStatus
{
    public const string Pending = nameof(Pending);

    public const string Executed = nameof(Executed);

    public static readonly string[] All = { Pending, Executed };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}