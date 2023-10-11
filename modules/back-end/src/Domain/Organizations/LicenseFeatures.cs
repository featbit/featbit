namespace Domain.Organizations;

public static class LicenseFeatures
{
    public const string Sso = "sso";
    public const string Schedule = "schedule";

    public static readonly string[] All = { Sso, Schedule };

    public static bool IsDefined(string feature)
    {
        return All.Contains(feature);
    }
}