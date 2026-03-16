using System.ComponentModel.DataAnnotations;

namespace Api.Cors;

public class CorsOptions : IValidatableObject
{
    public const string Cors = nameof(Cors);

    public bool Enabled { get; set; }

    [MaxLength(4096, ErrorMessage = "AllowedOrigins must not exceed 4096 characters.")]
    public string AllowedOrigins { get; set; } = string.Empty;

    [MaxLength(1024, ErrorMessage = "AllowedHeaders must not exceed 1024 characters.")]
    public string AllowedHeaders { get; set; } = string.Empty;

    [MaxLength(256, ErrorMessage = "AllowedMethods must not exceed 256 characters.")]
    public string AllowedMethods { get; set; } = string.Empty;

    public bool AllowCredentials { get; set; }

    public string[] ParsedOrigins => ParseDelimited(AllowedOrigins);

    public string[] ParsedHeaders => ParseDelimited(AllowedHeaders);

    public string[] ParsedMethods => ParseDelimited(AllowedMethods);

    public bool AllowAnyOrigins => IsSingleWildcard(ParsedOrigins);

    public bool AllowAnyHeaders => IsSingleWildcard(ParsedHeaders);

    public bool AllowAnyMethods => IsSingleWildcard(ParsedMethods);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!Enabled)
        {
            yield break;
        }

        var origins = ParsedOrigins;
        var headers = ParsedHeaders;
        var methods = ParsedMethods;

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

        if (ContainsComma(AllowedOrigins))
        {
            yield return new ValidationResult(
                "AllowedOrigins uses ';' as the delimiter. Commas are not supported.",
                [nameof(AllowedOrigins)]
            );
        }

        if (ContainsComma(AllowedHeaders))
        {
            yield return new ValidationResult(
                "AllowedHeaders uses ';' as the delimiter. Commas are not supported.",
                [nameof(AllowedHeaders)]
            );
        }

        if (ContainsComma(AllowedMethods))
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
