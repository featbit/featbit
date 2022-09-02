using Domain.Utils.ExtensionMethods;

namespace Domain.Streaming;

public class RequestHandler
{
    public static bool TryAcceptRequest(
        string sdkType, 
        string version, 
        string tokenString, 
        // for testability
        long? currentTimestamp = null)
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
        
        // token timestamp
        var current = currentTimestamp ?? DateTime.UtcNow.ToUnixTimeMilliseconds();
        if (Math.Abs(current - token.Timestamp) > 30 * 1000)
        {
            return false;
        }

        return true;
    }
}