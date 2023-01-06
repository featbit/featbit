namespace Domain.Environments;

public class SecretTypes
{
    public const string Server = "server";

    public const string Client = "client";

    public static readonly string[] All = { Server, Client };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}