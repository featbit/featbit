using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace Api.Cors;

public sealed class CorsOptionsValidator : IValidateOptions<CorsOptions>
{
    private readonly IConfiguration _configuration;

    public CorsOptionsValidator(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public ValidateOptionsResult Validate(string? name, CorsOptions options)
    {
        if (!options.Enabled)
        {
            return ValidateOptionsResult.Success;
        }

        var failures = new List<string>();

        // Comma-delimiter guard — check the raw config strings before they were parsed.
        var rawOrigins = _configuration[$"{CorsOptions.Cors}:{nameof(CorsOptions.AllowedOrigins)}"];
        var rawHeaders = _configuration[$"{CorsOptions.Cors}:{nameof(CorsOptions.AllowedHeaders)}"];
        var rawMethods = _configuration[$"{CorsOptions.Cors}:{nameof(CorsOptions.AllowedMethods)}"];

        if (ContainsComma(rawOrigins))
            failures.Add("AllowedOrigins uses ';' as the delimiter. Commas are not supported.");
        if (ContainsComma(rawHeaders))
            failures.Add("AllowedHeaders uses ';' as the delimiter. Commas are not supported.");
        if (ContainsComma(rawMethods))
            failures.Add("AllowedMethods uses ';' as the delimiter. Commas are not supported.");

        // Required-value checks.
        if (options.AllowedOrigins.Length == 0)
            failures.Add("AllowedOrigins must contain at least one value when CORS is enabled. Use ';' as the delimiter and '*' for wildcard.");
        if (options.AllowedHeaders.Length == 0)
            failures.Add("AllowedHeaders must contain at least one value when CORS is enabled. Use ';' as the delimiter and '*' for wildcard.");
        if (options.AllowedMethods.Length == 0)
            failures.Add("AllowedMethods must contain at least one value when CORS is enabled. Use ';' as the delimiter and '*' for wildcard.");

        // Wildcard-mixing checks.
        if (ContainsWildcardAndExplicitValues(options.AllowedOrigins))
            failures.Add("AllowedOrigins cannot mix wildcard '*' with explicit values.");
        if (ContainsWildcardAndExplicitValues(options.AllowedHeaders))
            failures.Add("AllowedHeaders cannot mix wildcard '*' with explicit values.");
        if (ContainsWildcardAndExplicitValues(options.AllowedMethods))
            failures.Add("AllowedMethods cannot mix wildcard '*' with explicit values.");

        // Credential + wildcard origin check.
        if (options.AllowCredentials && options.AllowedOrigins.Any(o => o == "*"))
            failures.Add("AllowCredentials cannot be used with a wildcard '*' origin. Specify explicit origins instead.");

        // Origin URI format check.
        foreach (var origin in options.AllowedOrigins.Where(o => o != "*"))
        {
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
                (uri.Scheme != "http" && uri.Scheme != "https"))
            {
                failures.Add(
                    $"AllowedOrigins contains an invalid value '{origin}'. Each origin must be an absolute URI with an 'http' or 'https' scheme (e.g. 'https://example.com').");
            }
        }

        return failures.Count > 0
            ? ValidateOptionsResult.Fail(failures)
            : ValidateOptionsResult.Success;
    }

    private static bool ContainsWildcardAndExplicitValues(string[] values)
    {
        return values.Length > 1 && values.Any(v => v == "*");
    }

    private static bool ContainsComma(string? value)
    {
        return !string.IsNullOrWhiteSpace(value) && value.Contains(',');
    }
}
