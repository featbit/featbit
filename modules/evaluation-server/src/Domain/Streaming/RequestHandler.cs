namespace Domain.Streaming;

public class RequestHandler
{
    public static bool TryAcceptRequest(string sdkType, string version, string tokenString)
    {
        // sdkType
        if (!SdkTypes.IsRegistered(sdkType))
        {
            return false;
        }
        
        // version
        if (!Version.IsSupported(version))
        {
            return false;
        }

        // connection token
        var token = new Token(tokenString);
        if (!token.IsValid)
        {
            return false;
        }

        return true;
    }
}