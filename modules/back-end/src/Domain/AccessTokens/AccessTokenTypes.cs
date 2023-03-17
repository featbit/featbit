namespace Domain.AccessTokens;

public class AccessTokenTypes
{
    public const string Personal = "Personal";

    public const string Service = "Service";

    public static readonly string[] All = { Personal, Service };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}