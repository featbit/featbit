using Microsoft.Extensions.Options;

namespace Api.Cors;

public sealed class CorsOptionsValidator : IValidateOptions<CorsOptions>
{
    public ValidateOptionsResult Validate(string? name, CorsOptions options)
    {
        if (!options.Enabled)
        {
            return ValidateOptionsResult.Success;
        }

        var failures = new List<string>();

        ValidateArrayValues(options.AllowedOrigins, nameof(options.AllowedOrigins));
        ValidateArrayValues(options.AllowedHeaders, nameof(options.AllowedHeaders));
        ValidateArrayValues(options.AllowedMethods, nameof(options.AllowedMethods));

        // Specifying AllowAnyOrigin and AllowCredentials is an insecure configuration and can result in cross-site request forgery.
        if (options.AllowAnyOrigins && options.AllowCredentials)
        {
            failures.Add(
                "AllowCredentials cannot be used with a wildcard '*' origin. Specify explicit origins instead."
            );
        }

        foreach (var origin in options.AllowedOrigins.Where(o => o != "*"))
        {
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || (uri.Scheme != "http" && uri.Scheme != "https"))
            {
                failures.Add(
                    $"AllowedOrigins contains an invalid value '{origin}'. Each origin must be an absolute URI with an 'http' or 'https' scheme (e.g. 'https://example.com').");
            }
        }

        return failures.Count > 0
            ? ValidateOptionsResult.Fail(failures)
            : ValidateOptionsResult.Success;

        void ValidateArrayValues(string[] values, string fieldName)
        {
            if (values.Length == 0)
            {
                failures.Add(
                    $"{fieldName} must contain at least one value when CORS is enabled. Use ';' as the delimiter and '*' for wildcard."
                );
            }

            if (values.Any(v => v.Contains(',')))
            {
                failures.Add($"{fieldName} uses ';' as the delimiter. Commas are not supported.");
            }

            if (values.Length > 1 && values.Any(v => v == "*"))
            {
                failures.Add($"{fieldName} cannot mix wildcard '*' with explicit values.");
            }
        }
    }
}