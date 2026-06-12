using System.Globalization;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

if (args.Any(x => x is "--help" or "-h"))
{
    SeedOptions.PrintUsage();
    return;
}

var options = SeedOptions.Parse(args);
var users = BuildUsers(options).ToArray();

using var http = new HttpClient();
http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", options.EnvSecret);

var evaluatedUsers = await EvaluateUsersAsync(http, options, users);
var metricEvents = BuildMetricEvents(options, evaluatedUsers).ToArray();
var insights = BuildInsights(options, evaluatedUsers, metricEvents).ToArray();

if (!options.DryRun)
{
    await SendInsightsAsync(http, options, insights);
}

Console.WriteLine(options.DryRun
    ? $"Dry run: evaluated {evaluatedUsers.Length} users and built {metricEvents.Length} metric events."
    : $"Seeded {evaluatedUsers.Length} evaluated users and {metricEvents.Length} metric events.");

Console.WriteLine($"Flag: {options.FlagKey}");
Console.WriteLine($"Evaluation URL: {options.EvaluationUrl}");
Console.WriteLine($"Users: {options.Users}");
Console.WriteLine($"Seed: {options.Seed}");
Console.WriteLine("Actual variation split:");
foreach (var group in evaluatedUsers
             .GroupBy(x => x.Variation.MatchKey)
             .OrderByDescending(x => x.Count())
             .ThenBy(x => x.Key, StringComparer.Ordinal))
{
    var sample = group.First().Variation;
    Console.WriteLine(
        $"  {sample.Label}: {group.Count()} users ({group.Count() * 100.0 / evaluatedUsers.Length:0.##}%, sendToExperiment={sample.SendToExperiment.ToString().ToLowerInvariant()})");
}

Console.WriteLine($"Metrics: {string.Join(", ", options.Metrics.Select(x => x.ToSummary()))}");

static IEnumerable<SeedUser> BuildUsers(SeedOptions options)
{
    for (var index = 0; index < options.Users; index++)
    {
        var key = StableUserKey(options.UserPrefix, options.Seed, index);
        yield return new SeedUser(key);
    }
}

static async Task<EvaluatedUser[]> EvaluateUsersAsync(HttpClient http, SeedOptions options, SeedUser[] users)
{
    var evaluated = new List<EvaluatedUser>(users.Length);
    var endpoint = new Uri(
        new Uri(options.EvaluationUrl.TrimEnd('/') + "/"),
        "api/public/sdk/client/latest-all?timestamp=0");

    foreach (var user in users)
    {
        using var content = new StringContent(
            $$"""{"keyId":"{{JsonEncodedText.Encode(user.Key).ToString()}}","name":"{{JsonEncodedText.Encode(user.Key).ToString()}}"}""",
            Encoding.UTF8,
            "application/json");

        var response = await http.PostAsync(endpoint, content);
        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Client SDK evaluation failed for user '{user.Key}': {(int)response.StatusCode} {response.ReasonPhrase}. {body}");
        }

        evaluated.Add(new EvaluatedUser(user, ReadVariation(options.FlagKey, user.Key, body)));
    }

    return evaluated.ToArray();
}

static EvaluatedVariation ReadVariation(string flagKey, string userKey, string body)
{
    using var doc = JsonDocument.Parse(body);
    var flags = doc.RootElement
        .GetProperty("data")
        .GetProperty("featureFlags")
        .EnumerateArray();

    foreach (var flag in flags)
    {
        if (GetJsonString(flag, "id") != flagKey)
        {
            continue;
        }

        var variationId = GetJsonString(flag, "variationId");
        if (string.IsNullOrWhiteSpace(variationId))
        {
            throw new InvalidOperationException(
                $"Flag '{flagKey}' evaluated user '{userKey}' without a variation id.");
        }

        return new EvaluatedVariation(
            variationId,
            GetJsonString(flag, "variation") ?? string.Empty,
            GetJsonBool(flag, "sendToExperiment") ?? false);
    }

    throw new InvalidOperationException(
        $"Flag '{flagKey}' was not returned for user '{userKey}'. Check --flag-key and the target environment.");
}

static string? GetJsonString(JsonElement element, string property)
{
    return element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
        ? value.GetString()
        : null;
}

static bool? GetJsonBool(JsonElement element, string property)
{
    return element.TryGetProperty(property, out var value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False
        ? value.GetBoolean()
        : null;
}

static string StableUserKey(string prefix, int seed, int index)
{
    var input = Encoding.UTF8.GetBytes($"{prefix}:{seed}:{index}");
    var hash = SHA256.HashData(input);
    var token = Convert.ToBase64String(hash[..12])
        .TrimEnd('=')
        .Replace('+', '-')
        .Replace('/', '_');

    return $"{prefix}-{seed}-{index:000000}-{token}";
}

static IEnumerable<MetricEmission> BuildMetricEvents(SeedOptions options, EvaluatedUser[] evaluatedUsers)
{
    foreach (var group in evaluatedUsers
                 .GroupBy(x => x.Variation.MatchKey)
                 .OrderBy(x => x.Key, StringComparer.Ordinal))
    {
        var users = group.OrderBy(x => x.User.Key, StringComparer.Ordinal).ToArray();
        var variation = users[0].Variation;

        foreach (var metric in options.Metrics)
        {
            if (!TryGetTarget(metric, variation, out var target) || target <= 0 || users.Length == 0)
            {
                continue;
            }

            foreach (var emission in BuildMetricEventsForVariation(metric, users, target))
            {
                yield return emission;
            }
        }
    }
}

static bool TryGetTarget(MetricPlan metric, EvaluatedVariation variation, out double target)
{
    return metric.Targets.TryGetValue(variation.Value, out target) ||
           metric.Targets.TryGetValue(variation.Id, out target);
}

static IEnumerable<MetricEmission> BuildMetricEventsForVariation(
    MetricPlan metric,
    EvaluatedUser[] users,
    double target)
{
    if (metric.Type == "binary" || metric.Agg == "once")
    {
        var convertedUsers = TargetAsUserCount(target, users.Length);
        for (var index = 0; index < convertedUsers; index++)
        {
            yield return new MetricEmission(users[index].User, metric.Event, 1);
        }

        yield break;
    }

    switch (metric.Agg)
    {
        case "count":
            var eventCount = (int)Math.Round(target, MidpointRounding.AwayFromZero);
            for (var slot = 0; slot < eventCount; slot++)
            {
                yield return new MetricEmission(users[slot % users.Length].User, metric.Event, 1);
            }
            break;

        case "sum":
            foreach (var user in users)
            {
                yield return new MetricEmission(user.User, metric.Event, (float)(target / users.Length));
            }
            break;

        case "average":
            foreach (var user in users)
            {
                yield return new MetricEmission(user.User, metric.Event, (float)target);
            }
            break;

        default:
            throw new ArgumentException($"Unsupported metric aggregation: {metric.Agg}");
    }
}

static IEnumerable<Insight> BuildInsights(
    SeedOptions options,
    EvaluatedUser[] evaluatedUsers,
    MetricEmission[] metricEvents)
{
    var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    var metricsByUser = metricEvents
        .GroupBy(x => x.User.Key)
        .ToDictionary(x => x.Key, x => x.ToArray(), StringComparer.Ordinal);

    foreach (var evaluatedUser in evaluatedUsers)
    {
        var user = evaluatedUser.User;
        var metrics = metricsByUser.GetValueOrDefault(user.Key) ?? [];

        yield return new Insight
        {
            User = new EndUser(user.Key, user.Key),
            Variations =
            [
                new VariationInsight(
                    options.FlagKey,
                    new Variation(evaluatedUser.Variation.Id, evaluatedUser.Variation.Value),
                    evaluatedUser.Variation.SendToExperiment,
                    now)
            ],
            Metrics = metrics
                .Select(x => new MetricInsight(
                    "/api/public/insight/track",
                    "CustomEvent",
                    x.EventName,
                    x.NumericValue,
                    "server",
                    now))
                .ToArray()
        };
    }
}

static async Task SendInsightsAsync(HttpClient http, SeedOptions options, Insight[] insights)
{
    var endpoint = new Uri(new Uri(options.EvaluationUrl.TrimEnd('/') + "/"), "api/public/insight/track");

    foreach (var batch in insights.Chunk(options.BatchSize))
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
    }
}

static int TargetAsUserCount(double target, int users)
{
    var count = target is >= 0 and <= 1
        ? (int)Math.Round(users * target, MidpointRounding.AwayFromZero)
        : (int)Math.Round(target, MidpointRounding.AwayFromZero);

    return Math.Clamp(count, 0, users);
}

sealed record SeedOptions(
    string EvaluationUrl,
    string EnvSecret,
    string FlagKey,
    int Users,
    MetricPlan[] Metrics,
    int Seed,
    int BatchSize,
    string UserPrefix,
    bool DryRun)
{
    public static SeedOptions Parse(string[] args)
    {
        var values = ArgBag.Parse(args);
        var dryRun = values.Has("dry-run");
        var envSecret = Get(values, "env-secret", "");

        if (string.IsNullOrWhiteSpace(envSecret))
        {
            throw new ArgumentException("--env-secret is required.");
        }

        var metrics = ParseMetrics(values);
        if (metrics.Length == 0)
        {
            throw new ArgumentException("At least one --metric or --guardrail is required.");
        }

        return new SeedOptions(
            Get(values, "evaluation-url", "http://localhost:5100"),
            envSecret,
            Get(values, "flag-key", "pricing-self-host-value-prop"),
            GetInt(values, "users", 3000, min: 1),
            metrics,
            GetInt(values, "seed", 20260604),
            GetInt(values, "batch-size", 50, min: 1),
            Get(values, "user-prefix", "rd-seed"),
            dryRun);
    }

    public static void PrintUsage()
    {
        Console.WriteLine("""
        Seeds FeatBit insights by using the real feature flag split.

        The tool only generates stable synthetic user keyIds. It calls FeatBit
        evaluation endpoint for each user, lets the live feature flag targeting
        and rollout choose the variation, then emits insight events using the
        same user keyId.

        Example:
          dotnet run tools/seed-release-decision-insights.cs -- \
            --env-secret <server-sdk-secret> \
            --evaluation-url http://localhost:5100 \
            --flag-key pricing-self-host-value-prop \
            --users 3000 \
            --metric self_host_high_intent_cta_clicked:binary:once:control=0.04,cost_savings=0.055,security_private=0.05

        Metric format:
          --metric <event>:<binary|continuous>:<once|count|sum|average>:<variation=target,...>
          --guardrail uses the same format.

        Variation target keys:
          Use either the real variation string value or the real variation id.
          The script does not accept --variant, --variation-id, or any manual
          split configuration. Actual user counts come from FeatBit evaluation.

        Target semantics:
          binary/once: target <= 1 is a rate over the users actually evaluated
                       into that variation; target > 1 is converted-user count.
          continuous/count: target is total event count for that variation.
          continuous/sum: target is total numeric sum for that variation.
          continuous/average: target is per-user average value for that variation.
        """);
    }

    private static MetricPlan[] ParseMetrics(ArgBag values)
    {
        return values.All("metric")
            .Select(x => ParseMetric(x, false))
            .Concat(values.All("guardrail").Select(x => ParseMetric(x, true)))
            .ToArray();
    }

    private static MetricPlan ParseMetric(string value, bool isGuardrail)
    {
        var parts = value.Split(':', 4, StringSplitOptions.TrimEntries);
        if (parts.Length != 4)
        {
            throw new ArgumentException($"Invalid metric spec: {value}");
        }

        var type = NormalizeMetricType(parts[1]);
        var agg = NormalizeMetricAgg(parts[2]);
        var targets = ParseTargets(parts[3]);

        return new MetricPlan(parts[0], type, agg, targets, isGuardrail);
    }

    private static IReadOnlyDictionary<string, double> ParseTargets(string value)
    {
        return value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => SplitPair(x, "metric target"))
            .ToDictionary(
                x => x.Key,
                x => ParseDouble(x.Value, $"Invalid metric target: {x.Key}={x.Value}"),
                StringComparer.OrdinalIgnoreCase);
    }

    private static (string Key, string Value) SplitPair(string value, string label)
    {
        var index = value.IndexOf('=', StringComparison.Ordinal);
        if (index <= 0 || index == value.Length - 1)
        {
            throw new ArgumentException($"Invalid {label} pair: {value}");
        }

        return (value[..index].Trim(), value[(index + 1)..].Trim());
    }

    private static string NormalizeMetricType(string value)
    {
        return value.ToLowerInvariant() switch
        {
            "binary" => "binary",
            "continuous" => "continuous",
            _ => throw new ArgumentException($"Unsupported metric type: {value}")
        };
    }

    private static string NormalizeMetricAgg(string value)
    {
        return value.ToLowerInvariant() switch
        {
            "once" => "once",
            "count" => "count",
            "sum" => "sum",
            "average" => "average",
            _ => throw new ArgumentException($"Unsupported metric aggregation: {value}")
        };
    }

    private static string Get(ArgBag values, string key, string fallback) =>
        GetOptional(values, key) is { Length: > 0 } value ? value : fallback;

    private static string? GetOptional(ArgBag values, string key) => values.Last(key);

    private static int GetInt(ArgBag values, string key, int fallback, int? min = null)
    {
        var value = GetOptional(values, key);
        var parsed = int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number)
            ? number
            : fallback;

        if (min.HasValue && parsed < min.Value)
        {
            throw new ArgumentException($"--{key} must be greater than or equal to {min.Value}.");
        }

        return parsed;
    }

    private static double ParseDouble(string value, string message)
    {
        return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : throw new ArgumentException(message);
    }
}

sealed record SeedUser(string Key);

sealed record EvaluatedUser(SeedUser User, EvaluatedVariation Variation);

sealed record EvaluatedVariation(string Id, string Value, bool SendToExperiment)
{
    public string MatchKey => string.IsNullOrWhiteSpace(Value) ? Id : Value;

    public string Label => string.IsNullOrWhiteSpace(Value)
        ? Id
        : $"{Value} ({Id})";
}

sealed record MetricEmission(SeedUser User, string EventName, float NumericValue);

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

sealed record MetricPlan(
    string Event,
    string Type,
    string Agg,
    IReadOnlyDictionary<string, double> Targets,
    bool IsGuardrail)
{
    public string ToSummary()
    {
        var kind = IsGuardrail ? "guardrail" : "primary";
        var targets = string.Join(",", Targets.Select(x => $"{x.Key}={x.Value.ToString(CultureInfo.InvariantCulture)}"));
        return $"{kind}:{Event}:{Type}:{Agg}:{targets}";
    }
}

sealed class ArgBag
{
    private readonly Dictionary<string, List<string>> _values = new(StringComparer.OrdinalIgnoreCase);

    public static ArgBag Parse(string[] args)
    {
        var bag = new ArgBag();

        for (var i = 0; i < args.Length; i++)
        {
            if (!args[i].StartsWith("--", StringComparison.Ordinal))
            {
                continue;
            }

            var raw = args[i][2..];
            var equals = raw.IndexOf('=', StringComparison.Ordinal);
            if (equals > 0)
            {
                bag.Add(raw[..equals], raw[(equals + 1)..]);
                continue;
            }

            if (i + 1 >= args.Length || args[i + 1].StartsWith("--", StringComparison.Ordinal))
            {
                bag.Add(raw, "true");
            }
            else
            {
                bag.Add(raw, args[++i]);
            }
        }

        return bag;
    }

    public bool Has(string key) => _values.ContainsKey(key);

    public string? Last(string key) =>
        _values.TryGetValue(key, out var values) && values.Count > 0 ? values[^1] : null;

    public IEnumerable<string> All(string key) =>
        _values.TryGetValue(key, out var values) ? values : [];

    private void Add(string key, string value)
    {
        if (!_values.TryGetValue(key, out var values))
        {
            values = [];
            _values[key] = values;
        }

        values.Add(value);
    }
}

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(Insight[]))]
sealed partial class SeedJsonContext : JsonSerializerContext;
