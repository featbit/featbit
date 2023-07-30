namespace Domain.FlagSchedules;

public class FlagScheduleStatus
{
    public const string WaitForExecution = nameof(WaitForExecution);

    public const string Executed = nameof(Executed);

    public static readonly string[] All = { WaitForExecution, Executed };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}