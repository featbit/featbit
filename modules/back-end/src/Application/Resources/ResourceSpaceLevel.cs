namespace Application.Resources;

public class ResourceSpaceLevel
{
    public const string Workspace = "workspace";

    public const string Organization = "organization";

    public static bool IsDefined(string value)
    {
        return value is Workspace or Organization;
    }
}