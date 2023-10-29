namespace Domain.Organizations;

public static class LicenseFeatures
{
    public const string Asterisk = "*"; // all features
    public const string Sso = "sso";
    public const string Schedule = "schedule";
    public const string CreateOrg = "create-org";
    public const string ChangeRequest = "change-request";
    
    public static readonly string[] All = { Asterisk, Sso, Schedule, CreateOrg, ChangeRequest };

    public static bool IsDefined(string feature)
    {
        return All.Contains(feature);
    }
}