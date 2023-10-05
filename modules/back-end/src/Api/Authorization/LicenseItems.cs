namespace Api.Authorization;

public class LicenseItems
{
    public const string Sso = nameof(Sso);
    public const string Schedule = nameof(Schedule);

    public static readonly string[] All = { Sso, Schedule };

    public static bool IsDefined(string licenseItem)
    {
        return All.Contains(licenseItem);
    }
}