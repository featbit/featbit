using System.Net.WebSockets;
using Domain.Shared;
using Microsoft.Extensions.Internal;

namespace Streaming.Connections;

public class RequestValidator : IRequestValidator
{
    private readonly ISystemClock _systemClock;
    private readonly IStore _store;

    public RequestValidator(ISystemClock systemClock, IStore store)
    {
        _systemClock = systemClock;
        _store = store;
    }

    public async Task<Connection?> ValidateAsync(WebSocket ws, string type, string version, string tokenString)
    {
        if (!ConnectionType.IsRegistered(type) || !ConnectionVersion.IsSupported(version))
        {
            return null;
        }

        // token
        var token = new Token(tokenString.AsSpan());
        var current = _systemClock.UtcNow.ToUnixTimeMilliseconds();
        if (!token.IsValid || Math.Abs(current - token.Timestamp) > 30 * 1000)
        {
            return null;
        }

        // secret
        var secret = await _store.GetSecretAsync(token.SecretString);
        if (secret is null || secret.Type != type)
        {
            return null;
        }

        // websocket state
        if (ws is not { State: WebSocketState.Open })
        {
            return null;
        }

        var connection = new Connection(Guid.NewGuid().ToString("D"), ws, secret, type, version, current);
        return connection;
    }
}