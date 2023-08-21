namespace Domain.FlagSchedules;

public class FlagScheduleStatus
{
    public const string Pending = nameof(Pending);

    public const string Applied = nameof(Applied);

    public static readonly string[] All = { Pending, Applied };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}