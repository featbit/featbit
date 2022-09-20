namespace Api.Middlewares;

public static class ApiExceptionMiddlewareExtension
{
    public static IApplicationBuilder UseApiExceptionHandler(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<ApiExceptionMiddleware>();
    }
}