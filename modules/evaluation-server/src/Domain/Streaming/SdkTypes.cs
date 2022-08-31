namespace Domain.Streaming;

public class SdkTypes
{
    public const string Server = "server";
    public const string Client = "client";

    public static readonly string[] All = { Server, Client };

    public static bool IsRegistered(string sdkType) => All.Contains(sdkType);
}