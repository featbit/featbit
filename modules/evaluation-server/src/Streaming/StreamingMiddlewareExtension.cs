using Microsoft.AspNetCore.Builder;

namespace Streaming;

public static class StreamingMiddlewareExtension
{
    public static IApplicationBuilder UseStreaming(this IApplicationBuilder builder)
    {
        return builder
            .UseWebSockets()
            .UseMiddleware<StreamingMiddleware>();
    }
}