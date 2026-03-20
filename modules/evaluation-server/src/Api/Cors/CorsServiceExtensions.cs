using Microsoft.Extensions.Options;

namespace Api.Cors;

public static class CorsServiceExtensions
{
    public static WebApplicationBuilder AddCustomCors(this WebApplicationBuilder builder)
    {
        var corsSection = builder.Configuration.GetSection(CorsOptions.SectionName);
        builder.Services.AddCors();

        builder.Services
            .AddOptions<CorsOptions>()
            .Configure(options =>
            {
                // Bind scalar properties (Enabled, AllowCredentials) from configuration.
                options.Enabled = corsSection.GetValue<bool>(nameof(CorsOptions.Enabled));
                options.AllowCredentials = corsSection.GetValue<bool>(nameof(CorsOptions.AllowCredentials));

                // Parse semicolon-delimited strings into arrays once at startup.
                options.AllowedOrigins = ParseDelimited(corsSection[nameof(CorsOptions.AllowedOrigins)]);
                options.AllowedHeaders = ParseDelimited(corsSection[nameof(CorsOptions.AllowedHeaders)]);
                options.AllowedMethods = ParseDelimited(corsSection[nameof(CorsOptions.AllowedMethods)]);
            })
            .ValidateOnStart();

        builder.Services.AddSingleton<IValidateOptions<CorsOptions>, CorsOptionsValidator>();

        return builder;

        static string[] ParseDelimited(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return [];
            }

            return value
                .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(s => s.Length > 0)
                .ToArray();
        }
    }
}