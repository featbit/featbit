namespace Infrastructure.License;

public class LicenseItem
{
    public const string Sso = nameof(Sso);

    public static readonly string[] All = { Sso };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}