namespace Domain.Organizations;

public static class LicenseFeatures
{
    public const string Sso = "sso";
    public const string Schedule = "schedule";
    public const string CreateOrg = "create-org";

    public static readonly string[] All = { Sso, Schedule, CreateOrg };

    public static bool IsDefined(string feature)
    {
        return All.Contains(feature);
    }
}