using System.ComponentModel.DataAnnotations;

namespace Api.Cors;

public class CorsOptions : IValidatableObject
{
    public const string Cors = nameof(Cors);

    public bool Enabled { get; set; }

    public bool AllowCredentials { get; set; }

    private string _rawOrigins = string.Empty;
    private string _rawHeaders = string.Empty;
    private string _rawMethods = string.Empty;

    // Write-only setters for configuration binding; values are parsed on assignment.
    // Consumers read the parsed arrays below — the raw strings are not exposed.
    public string AllowedOrigins
    {
        set { _rawOrigins = value ?? string.Empty; Origins = ParseDelimited(_rawOrigins); }
    }

    public string AllowedHeaders
    {
        set { _rawHeaders = value ?? string.Empty; Headers = ParseDelimited(_rawHeaders); }
    }

    public string AllowedMethods
    {
        set { _rawMethods = value ?? string.Empty; Methods = ParseDelimited(_rawMethods); }
    }

    public string[] Origins { get; private set; } = [];

    public string[] Headers { get; private set; } = [];

    public string[] Methods { get; private set; } = [];

    public bool AllowAnyOrigins => IsSingleWildcard(Origins);

    public bool AllowAnyHeaders => IsSingleWildcard(Headers);

    public bool AllowAnyMethods => IsSingleWildcard(Methods);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!Enabled)
        {
            yield break;
        }

        // Length guards — validated here because [MaxLength] cannot introspect write-only setters.
        if (_rawOrigins.Length > 4096)
        {
            yield return new ValidationResult(
                "AllowedOrigins must not exceed 4096 characters.",
                [nameof(AllowedOrigins)]
            );
        }

        if (_rawHeaders.Length > 1024)
        {
            yield return new ValidationResult(
                "AllowedHeaders must not exceed 1024 characters.",
                [nameof(AllowedHeaders)]
            );
        }

        if (_rawMethods.Length > 256)
        {
            yield return new ValidationResult(
                "AllowedMethods must not exceed 256 characters.",
                [nameof(AllowedMethods)]
            );
        }

        var origins = Origins;
        var headers = Headers;
        var methods = Methods;

        if (origins.Length == 0)
        {
            yield return new ValidationResult(
                "AllowedOrigins must contain at least one value when CORS is enabled. Use ';' as the delimiter and '*' for wildcard.",
                [nameof(AllowedOrigins)]
            );
        }

        if (headers.Length == 0)
        {
            yield return new ValidationResult(
                "AllowedHeaders must contain at least one value when CORS is enabled. Use ';' as the delimiter and '*' for wildcard.",
                [nameof(AllowedHeaders)]
            );
        }

        if (methods.Length == 0)
        {
            yield return new ValidationResult(
                "AllowedMethods must contain at least one value when CORS is enabled. Use ';' as the delimiter and '*' for wildcard.",
                [nameof(AllowedMethods)]
            );
        }

        if (ContainsComma(_rawOrigins))
        {
            yield return new ValidationResult(
                "AllowedOrigins uses ';' as the delimiter. Commas are not supported.",
                [nameof(AllowedOrigins)]
            );
        }

        if (ContainsComma(_rawHeaders))
        {
            yield return new ValidationResult(
                "AllowedHeaders uses ';' as the delimiter. Commas are not supported.",
                [nameof(AllowedHeaders)]
            );
        }

        if (ContainsComma(_rawMethods))
        {
            yield return new ValidationResult(
                "AllowedMethods uses ';' as the delimiter. Commas are not supported.",
                [nameof(AllowedMethods)]
            );
        }

        if (ContainsWildcardAndExplicitValues(origins))
        {
            yield return new ValidationResult(
                "AllowedOrigins cannot mix wildcard '*' with explicit values.",
                [nameof(AllowedOrigins)]
            );
        }

        if (ContainsWildcardAndExplicitValues(headers))
        {
            yield return new ValidationResult(
                "AllowedHeaders cannot mix wildcard '*' with explicit values.",
                [nameof(AllowedHeaders)]
            );
        }

        if (ContainsWildcardAndExplicitValues(methods))
        {
            yield return new ValidationResult(
                "AllowedMethods cannot mix wildcard '*' with explicit values.",
                [nameof(AllowedMethods)]
            );
        }

        if (AllowCredentials && origins.Any(o => o == "*"))
        {
            yield return new ValidationResult(
                "AllowCredentials cannot be used with a wildcard '*' origin. Specify explicit origins instead.",
                [nameof(AllowCredentials), nameof(AllowedOrigins)]
            );
        }

        foreach (var origin in origins.Where(o => o != "*"))
        {
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
                (uri.Scheme != "http" && uri.Scheme != "https"))
            {
                yield return new ValidationResult(
                    $"AllowedOrigins contains an invalid value '{origin}'. Each origin must be an absolute URI with an 'http' or 'https' scheme (e.g. 'https://example.com').",
                    [nameof(AllowedOrigins)]
                );
            }
        }
    }

    private static string[] ParseDelimited(string? value)
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

    private static bool IsSingleWildcard(string[] values)
    {
        return values.Length == 1 && values[0] == "*";
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
