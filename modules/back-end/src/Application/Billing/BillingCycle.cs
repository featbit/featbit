namespace Application.Billing;

public static class BillingCycle
{
    public const string Year = "year";
    public const string Month = "month";

    public static readonly string[] All = [Year, Month];

    public static bool IsDefined(string interval)
    {
        return All.Contains(interval);
    }
}