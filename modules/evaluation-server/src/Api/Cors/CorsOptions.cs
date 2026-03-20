using Microsoft.AspNetCore.Cors.Infrastructure;

namespace Api.Cors;

public class CorsOptions
{
    public const string SectionName = "Cors";

    public bool Enabled { get; set; }

    public bool AllowCredentials { get; set; }

    public string[] AllowedOrigins { get; set; } = [];

    public string[] AllowedHeaders { get; set; } = [];

    public string[] AllowedMethods { get; set; } = [];

    public bool AllowAnyOrigins => IsSingleWildcard(AllowedOrigins);

    public bool AllowAnyHeaders => IsSingleWildcard(AllowedHeaders);

    public bool AllowAnyMethods => IsSingleWildcard(AllowedMethods);

    private static bool IsSingleWildcard(string[] values) => values.Length == 1 && values[0] == "*";

    public void BuildCors(CorsPolicyBuilder builder)
    {
        if (AllowAnyOrigins)
        {
            builder.AllowAnyOrigin();
        }
        else
        {
            builder.WithOrigins(AllowedOrigins);
        }

        if (AllowAnyHeaders)
        {
            builder.AllowAnyHeader();
        }
        else
        {
            builder.WithHeaders(AllowedHeaders);
        }

        if (AllowAnyMethods)
        {
            builder.AllowAnyMethod();
        }
        else
        {
            builder.WithMethods(AllowedMethods);
        }

        if (AllowCredentials)
        {
            builder.AllowCredentials();
        }
    }
}