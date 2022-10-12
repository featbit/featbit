namespace Domain.Triggers;

public class TriggerTypes
{
    public const string FfGeneral = "feature-flag-general";

    public static readonly string[] All = { FfGeneral };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}