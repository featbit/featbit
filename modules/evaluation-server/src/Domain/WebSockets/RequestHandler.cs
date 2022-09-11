using System.Net.WebSockets;
using Domain.Core;
using Domain.Utils.ExtensionMethods;

namespace Domain.WebSockets;

public class RequestHandler
{
    public static Connection? TryAcceptRequest(
        WebSocket webSocket,
        string sdkType,
        string version,
        string tokenString,
        // for testability
        long? currentTimestamp = null)
    {
        // connection type
        if (!ConnectionType.IsRegistered(sdkType))
        {
            return null;
        }

        // version
        if (!Version.IsSupported(version))
        {
            return null;
        }

        // connection token
        var token = new Token(tokenString);
        if (!token.IsValid)
        {
            return null;
        }

        // token timestamp
        var current = currentTimestamp ?? DateTime.UtcNow.ToUnixTimeMilliseconds();
        if (Math.Abs(current - token.Timestamp) > 30 * 1000)
        {
            return null;
        }

        // websocket state
        if (webSocket is not { State: WebSocketState.Open })
        {
            return null;
        }

        var connection = new Connection(webSocket, token.Secret.EnvId, sdkType, version, current);
        return connection;
    }
}