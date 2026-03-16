namespace Api.Cors;

public class CorsOptions
{
    public const string Cors = nameof(Cors);

    public bool Enabled { get; set; }

    public bool AllowCredentials { get; set; }

    public string[] AllowedOrigins { get; set; } = [];

    public string[] AllowedHeaders { get; set; } = [];

    public string[] AllowedMethods { get; set; } = [];

    public bool AllowAnyOrigins => IsSingleWildcard(AllowedOrigins);

    public bool AllowAnyHeaders => IsSingleWildcard(AllowedHeaders);

    public bool AllowAnyMethods => IsSingleWildcard(AllowedMethods);

    private static bool IsSingleWildcard(string[] values)
    {
        return values.Length == 1 && values[0] == "*";
    }
}
