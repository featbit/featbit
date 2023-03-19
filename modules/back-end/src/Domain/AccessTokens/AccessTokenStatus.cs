namespace Domain.AccessTokens;

public class AccessTokenStatus
{
    public const string Active = "Active";

    public const string Inactive = "Inactive";

    public static readonly string[] All = { Active, Inactive };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}