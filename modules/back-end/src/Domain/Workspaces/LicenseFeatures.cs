namespace Domain.Workspaces;

public static class LicenseFeatures
{
    public const string Asterisk = "*"; // all features
    public const string Sso = "sso";
    public const string Schedule = "schedule";
    public const string MultiOrg = "multi-organization";
    public const string ChangeRequest = "change-request";
    public const string GlobalUser = "global-user";
    public const string ShareableSegment = "shareable-segment";
    public const string AutoAgents = "auto-agents";

    public static readonly string[] All =
        [Asterisk, Sso, Schedule, MultiOrg, ChangeRequest, GlobalUser, ShareableSegment, AutoAgents];

    public static bool IsDefined(string feature)
    {
        return All.Contains(feature);
    }
}