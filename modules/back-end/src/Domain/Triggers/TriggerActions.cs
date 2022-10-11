namespace Domain.Triggers;

public class TriggerActions
{
    public const string TurnOn = "turn-on";

    public const string TurnOff = "turn-off";

    public static readonly string[] All = { TurnOn, TurnOff };

    public static bool IsDefined(string action)
    {
        return All.Contains(action);
    }
}