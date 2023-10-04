namespace Application.License;

public class LicenseItem
{
    public const string Sso = nameof(Sso);
    
    public const string Schedule = nameof(Schedule);

    public static readonly string[] All = { Sso };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}