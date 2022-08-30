namespace Api.Middlewares;

public static class StreamingMiddlewareExtension
{
    public static IApplicationBuilder UseStreaming(this IApplicationBuilder builder)
    {
        return builder
            .UseWebSockets()
            .UseMiddleware<StreamingMiddleware>();
    }
}