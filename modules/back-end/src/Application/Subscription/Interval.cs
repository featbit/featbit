namespace Application.Subscription;

public static class Interval
{
    public const string Year = "year";
    public const string Month = "month";
    
    public static readonly string[] All = [Year, Month];
    
    public static bool IsDefined(string interval)
    {
        return All.Contains(interval);
    }
}