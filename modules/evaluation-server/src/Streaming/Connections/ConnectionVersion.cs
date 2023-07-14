namespace Streaming.Connections;

public class ConnectionVersion
{
    public const string V1 = "1";
        
    public const string V2 = "2";
    
    public static readonly string[] SupportedVersions = {V1, V2};
        
    public static bool IsSupported(string version)
    {
        if (string.IsNullOrWhiteSpace(version))
        {
            // null/whitespace string should be seen as V1
            return true;
        }
        
        return SupportedVersions.Contains(version);
    }
}