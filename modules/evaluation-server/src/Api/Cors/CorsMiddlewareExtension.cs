using Microsoft.Extensions.Options;

namespace Api.Cors;

public static class CorsMiddlewareExtension
{
    public static IApplicationBuilder UseCustomCors(this IApplicationBuilder builder)
    {
        var corsOptions = builder.ApplicationServices.GetRequiredService<IOptions<CorsOptions>>().Value;
        if (corsOptions.Enabled)
        {
            builder.UseCors(corsOptions.BuildCors);
        }

        return builder;
    }
}