using Microsoft.AspNetCore.Http;

namespace Streaming;

public static class StreamingHelper
{
    private const string StreamingPath = "/streaming";

    public static bool IsStreamingRequest(HttpContext context)
    {
        return context.Request.Path.StartsWithSegments(StreamingPath) && context.WebSockets.IsWebSocketRequest;
    }
}