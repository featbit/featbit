using System.Net.WebSockets;
using Streaming.Connections;

namespace Streaming.Shared;

public static class RequestHandler
{
    public static (Connection?, string) TryAcceptRequest(
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
            return (null, "invalid sdk type");
        }

        // version
        if (!ConnectionVersion.IsSupported(version))
        {
            return (null, "unsupported version");
        }

        // connection token
        var token = new Token(tokenString);
        if (!token.IsValid)
        {
            return (null, "invalid token");
        }

        // token timestamp
        var current = currentTimestamp ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (Math.Abs(current - token.Timestamp) > 30 * 1000)
        {
            return (null, "token timestamp is invalid");
        }

        // websocket state
        if (webSocket is not { State: WebSocketState.Open })
        {
            return (null, $"invalid websocket state: {webSocket?.State}");
        }

        var connection = new Connection(webSocket, token.Secret.EnvId, sdkType, version, current);
        return (connection, string.Empty);
    }
}