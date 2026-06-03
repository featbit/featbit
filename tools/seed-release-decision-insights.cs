using System.Globalization;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

var options = SeedOptions.Parse(args);
var seed = new Random(options.Seed);
var startedAt = options.StartUtc ?? DateTimeOffset.UtcNow.AddMinutes(-30);
var endpoint = new Uri(new Uri(options.EvaluationUrl.TrimEnd('/') + "/"), "api/public/insight/track");

var rows = BuildInsights(options, seed, startedAt).Chunk(options.BatchSize).ToArray();

using var http = new HttpClient();
http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", options.EnvSecret);

var sent = 0;
foreach (var batch in rows)
{
    var response = await http.PostAsync(
        endpoint,
        JsonContent.Create(batch, SeedJsonContext.Default.InsightArray));
    if (!response.IsSuccessStatusCode)
    {
        var body = await response.Content.ReadAsStringAsync();
        throw new InvalidOperationException(
            $"Track request failed: {(int)response.StatusCode} {response.ReasonPhrase}. {body}");
    }

    sent += batch.Length;
}

Console.WriteLine($"Seeded {sent} users to {endpoint}");
Console.WriteLine($"Flag: {options.FlagKey}");
Console.WriteLine($"Metric: {options.MetricEvent}");
Console.WriteLine($"Control: {options.ControlVariant} users={options.UsersPerVariant} rate={options.ControlRate:P1}");
Console.WriteLine($"Treatment: {options.TreatmentVariant} users={options.UsersPerVariant} rate={options.TreatmentRate:P1}");

static IEnumerable<Insight> BuildInsights(SeedOptions options, Random seed, DateTimeOffset startedAt)
{
    foreach (var variant in new[]
    {
        new VariantPlan(options.ControlVariant, options.ControlRate),
        new VariantPlan(options.TreatmentVariant, options.TreatmentRate)
    })
    {
        for (var index = 0; index < options.UsersPerVariant; index++)
        {
            var userKey = $"{options.UserPrefix}-{variant.Name}-{options.Seed}-{index:0000}";
            var exposureTime = startedAt.AddSeconds(index * 2);
            var converted = seed.NextDouble() < variant.ConversionRate;

            yield return new Insight
            {
                User = new EndUser(userKey, userKey),
                Variations =
                [
                    new VariationInsight(
                        options.FlagKey,
                        new Variation(variant.Name, variant.Name),
                        true,
                        exposureTime.ToUnixTimeMilliseconds())
                ],
                Metrics = converted
                    ? [
                        new MetricInsight(
                            "/api/public/insight/track",
                            "CustomEvent",
                            options.MetricEvent,
                            1,
                            "server",
                            exposureTime.AddSeconds(1).ToUnixTimeMilliseconds())
                    ]
                    : []
            };
        }
    }
}

sealed record SeedOptions(
    string EvaluationUrl,
    string EnvSecret,
    string FlagKey,
    string MetricEvent,
    string ControlVariant,
    string TreatmentVariant,
    int UsersPerVariant,
    double ControlRate,
    double TreatmentRate,
    int Seed,
    int BatchSize,
    string UserPrefix,
    DateTimeOffset? StartUtc)
{
    public static SeedOptions Parse(string[] args)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < args.Length; i++)
        {
            if (!args[i].StartsWith("--", StringComparison.Ordinal)) continue;
            var key = args[i][2..];
            if (i + 1 >= args.Length || args[i + 1].StartsWith("--", StringComparison.Ordinal))
            {
                values[key] = "true";
            }
            else
            {
                values[key] = args[++i];
            }
        }

        return new SeedOptions(
            Get(values, "evaluation-url", "http://localhost:5100"),
            Required(values, "env-secret"),
            Get(values, "flag-key", "abtest-trial001"),
            Get(values, "metric-event", "teste"),
            Get(values, "control-variant", "control"),
            Get(values, "treatment-variant", "treatment"),
            GetInt(values, "users-per-variant", 120),
            GetDouble(values, "control-rate", 0.20),
            GetDouble(values, "treatment-rate", 0.36),
            GetInt(values, "seed", 20260604),
            GetInt(values, "batch-size", 50),
            Get(values, "user-prefix", "rd-seed"),
            values.TryGetValue("start-utc", out var start)
                ? DateTimeOffset.Parse(start, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal)
                : null);
    }

    private static string Required(Dictionary<string, string> values, string key) =>
        values.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value
            : throw new ArgumentException($"--{key} is required");

    private static string Get(Dictionary<string, string> values, string key, string fallback) =>
        values.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value) ? value : fallback;

    private static int GetInt(Dictionary<string, string> values, string key, int fallback) =>
        values.TryGetValue(key, out var value) && int.TryParse(value, out var parsed) ? parsed : fallback;

    private static double GetDouble(Dictionary<string, string> values, string key, double fallback) =>
        values.TryGetValue(key, out var value) &&
        double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : fallback;
}

sealed record VariantPlan(string Name, double ConversionRate);

sealed record Insight
{
    [JsonPropertyName("user")]
    public required EndUser User { get; init; }

    [JsonPropertyName("variations")]
    public required VariationInsight[] Variations { get; init; }

    [JsonPropertyName("metrics")]
    public required MetricInsight[] Metrics { get; init; }
}

sealed record EndUser(
    [property: JsonPropertyName("keyId")] string KeyId,
    [property: JsonPropertyName("name")] string Name);

sealed record VariationInsight(
    [property: JsonPropertyName("featureFlagKey")] string FeatureFlagKey,
    [property: JsonPropertyName("variation")] Variation Variation,
    [property: JsonPropertyName("sendToExperiment")] bool SendToExperiment,
    [property: JsonPropertyName("timestamp")] long Timestamp);

sealed record Variation(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("value")] string Value);

sealed record MetricInsight(
    [property: JsonPropertyName("route")] string Route,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("eventName")] string EventName,
    [property: JsonPropertyName("numericValue")] float NumericValue,
    [property: JsonPropertyName("appType")] string AppType,
    [property: JsonPropertyName("timestamp")] long Timestamp);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(Insight[]))]
sealed partial class SeedJsonContext : JsonSerializerContext;
