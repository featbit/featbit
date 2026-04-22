namespace Application.Billing;

public static class BillingPlans
{
    public const string Free = "free";
    public const string Pro = "pro";
    public const string Growth = "growth";
    public const string Enterprise = "enterprise";

    public static readonly string[] All = [Free, Pro, Growth, Enterprise];

    public static bool IsDefined(string plan)
    {
        return All.Contains(plan);
    }
}