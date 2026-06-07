using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

if (args.Any(x => x is "--help" or "-h"))
{
    SeedOptions.PrintUsage();
    return;
}

var options = SeedOptions.Parse(args);
var endpoint = new Uri(new Uri(options.EvaluationUrl.TrimEnd('/') + "/"), "api/public/insight/track");
var insights = BuildInsights(options).ToArray();
var metricEvents = insights.Sum(x => x.Metrics.Length);

if (!options.DryRun)
{
    using var http = new HttpClient();
    http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", options.EnvSecret);

    var sent = 0;
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

        sent += batch.Length;
    }

    Console.WriteLine($"Seeded {sent} users to {endpoint}");
}
else
{
    Console.WriteLine($"Dry run: built {insights.Length} users for {endpoint}");
}

Console.WriteLine($"Env: {options.EnvId ?? "(from env secret)"}");
Console.WriteLine($"Flag: {options.FlagKey}");
Console.WriteLine($"Window: {options.StartDate:yyyy-MM-dd} -> {options.EndDate:yyyy-MM-dd}");
Console.WriteLine($"Variants: {string.Join(", ", options.Variants.Select(x => $"{x.Name}={x.Users} (insight id {x.InsightId})"))}");
Console.WriteLine($"Metrics: {string.Join(", ", options.Metrics.Select(x => x.ToSummary()))}");
Console.WriteLine($"Metric events: {metricEvents}");

static IEnumerable<Insight> BuildInsights(SeedOptions options)
{
    var totalUsers = Math.Max(1, options.Variants.Sum(x => x.Users));
    var windowStart = ToUtcOffset(options.StartDate);
    var windowEndExclusive = ToUtcOffset(options.EndDate.AddDays(1));
    var usableSeconds = Math.Max(60, (windowEndExclusive - windowStart).TotalSeconds - 120);
    var globalIndex = 0;

    foreach (var variant in options.Variants)
    {
        for (var userIndex = 0; userIndex < variant.Users; userIndex++, globalIndex++)
        {
            var userKey = $"{options.UserPrefix}-{Slug(variant.Name)}-{options.Seed}-{userIndex:000000}";
            var exposureOffset = usableSeconds * (globalIndex + 1) / (totalUsers + 1);
            var exposureTime = windowStart.AddSeconds(exposureOffset);
            var metrics = BuildMetricInsights(options, variant, userIndex, exposureTime, windowEndExclusive).ToArray();

            yield return new Insight
            {
                User = new EndUser(userKey, userKey),
                Variations =
                [
                    new VariationInsight(
                        options.FlagKey,
                        new Variation(variant.InsightId, variant.InsightValue),
                        true,
                        exposureTime.ToUnixTimeMilliseconds())
                ],
                Metrics = metrics
            };
        }
    }
}

static IEnumerable<MetricInsight> BuildMetricInsights(
    SeedOptions options,
    VariantPlan variant,
    int userIndex,
    DateTimeOffset exposureTime,
    DateTimeOffset windowEndExclusive)
{
    var metricOrdinal = 0;

    foreach (var metric in options.Metrics)
    {
        foreach (var value in MetricValues(metric, variant, userIndex))
        {
            var timestamp = exposureTime.AddSeconds(30 + (metricOrdinal * 5));
            if (timestamp >= windowEndExclusive)
            {
                timestamp = windowEndExclusive.AddMilliseconds(-1);
            }

            metricOrdinal++;

            yield return new MetricInsight(
                "/api/public/insight/track",
                "CustomEvent",
                metric.Event,
                (float)value,
                "server",
                timestamp.ToUnixTimeMilliseconds());
        }
    }
}

static IEnumerable<double> MetricValues(MetricPlan metric, VariantPlan variant, int userIndex)
{
    if (!metric.Targets.TryGetValue(variant.Name, out var target) || target <= 0 || variant.Users <= 0)
    {
        yield break;
    }

    if (metric.Type == "binary" || metric.Agg == "once")
    {
        var convertedUsers = TargetAsUserCount(target, variant.Users);
        if (userIndex < convertedUsers)
        {
            yield return 1;
        }

        yield break;
    }

    switch (metric.Agg)
    {
        case "count":
            var eventCount = (int)Math.Round(target, MidpointRounding.AwayFromZero);
            for (var slot = userIndex; slot < eventCount; slot += variant.Users)
            {
                yield return 1;
            }
            break;

        case "sum":
            yield return target / variant.Users;
            break;

        case "average":
            yield return target;
            break;

        default:
            throw new ArgumentException($"Unsupported metric aggregation: {metric.Agg}");
    }
}

static int TargetAsUserCount(double target, int users)
{
    var count = target is >= 0 and <= 1
        ? (int)Math.Round(users * target, MidpointRounding.AwayFromZero)
        : (int)Math.Round(target, MidpointRounding.AwayFromZero);

    return Math.Clamp(count, 0, users);
}

static DateTimeOffset ToUtcOffset(DateOnly date)
{
    return new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
}

static string Slug(string value)
{
    var chars = value.Select(ch => char.IsLetterOrDigit(ch) ? char.ToLowerInvariant(ch) : '-').ToArray();
    return new string(chars).Trim('-');
}

sealed record SeedOptions(
    string EvaluationUrl,
    string EnvSecret,
    string? EnvId,
    string FlagKey,
    VariantPlan[] Variants,
    MetricPlan[] Metrics,
    DateOnly StartDate,
    DateOnly EndDate,
    int Seed,
    int BatchSize,
    string UserPrefix,
    bool DryRun)
{
    public static SeedOptions Parse(string[] args)
    {
        var values = ArgBag.Parse(args);
        var dryRun = values.Has("dry-run");
        var today = DateOnly.FromDateTime(DateTimeOffset.UtcNow.UtcDateTime);
        var startDate = GetDate(values, "start-date")
            ?? GetStartUtcDate(values)
            ?? today.AddDays(-6);
        var endDate = GetDate(values, "end-date") ?? today;

        if (endDate < startDate)
        {
            throw new ArgumentException("--end-date must be on or after --start-date");
        }

        var variants = ParseVariants(values);
        var metrics = ParseMetrics(values, variants);
        var envSecret = Get(values, "env-secret", "");

        if (!dryRun && string.IsNullOrWhiteSpace(envSecret))
        {
            throw new ArgumentException("--env-secret is required unless --dry-run is set");
        }

        return new SeedOptions(
            Get(values, "evaluation-url", "http://localhost:5100"),
            envSecret,
            GetOptional(values, "env-id"),
            Get(values, "flag-key", "abtest-trial001"),
            variants,
            metrics,
            startDate,
            endDate,
            GetInt(values, "seed", 20260604),
            GetInt(values, "batch-size", 50),
            Get(values, "user-prefix", "rd-seed"),
            dryRun);
    }

    public static void PrintUsage()
    {
        Console.WriteLine("""
        Seeds real FeatBit insight events for release-decision analysis.

        Example:
          dotnet run tools/seed-release-decision-insights.cs -- \
            --env-secret <server-sdk-secret> \
            --env-id a30da40d-1f8a-4f4f-86a8-323ac65326d6 \
            --flag-key game-runner \
            --variant True=1200 --variant False=1180 \
            --variation-id True=<actual-true-variation-id> \
            --variation-id False=<actual-false-variation-id> \
            --metric mn1:binary:once:True=132,False=165 \
            --guardrail afa:binary:once:True=36,False=41 \
            --start-date 2026-06-01 --end-date 2026-06-06

        Metric format:
          --metric <event>:<binary|continuous>:<once|count|sum|average>:<variant=target,...>
          --guardrail uses the same format.

        Native FeatBit Insights:
          For the FeatBit flag Insights page, --variation-id must map each variant alias
          to the real feature flag variation id. Release-decision metric targets still use
          the readable aliases from --variant.

        Target semantics:
          binary/once: target <= 1 is a rate, target > 1 is converted-user count.
          continuous/count: target is total event count for that variant.
          continuous/sum: target is total numeric sum for that variant.
          continuous/average: target is per-user average value for that variant.

        Compatibility:
          Old control/treatment options still work:
          --control-variant control --treatment-variant treatment --users-per-variant 120
          --metric-event signup --control-rate 0.20 --treatment-rate 0.36
        """);
    }

    private static VariantPlan[] ParseVariants(ArgBag values)
    {
        var variationIds = ParseStringMap(values.All("variation-id"));
        var variationValues = ParseStringMap(values.All("variation-value"));
        var explicitVariants = values.All("variant")
            .Select(ParseVariant)
            .Select(x => WithInsightMapping(x, variationIds, variationValues))
            .ToArray();

        if (explicitVariants.Length > 0)
        {
            return explicitVariants;
        }

        var usersPerVariant = GetInt(values, "users-per-variant", 120);
        return
        [
            WithInsightMapping(new VariantPlan(Get(values, "control-variant", "control"), usersPerVariant), variationIds, variationValues),
            WithInsightMapping(new VariantPlan(Get(values, "treatment-variant", "treatment"), usersPerVariant), variationIds, variationValues)
        ];
    }

    private static MetricPlan[] ParseMetrics(ArgBag values, VariantPlan[] variants)
    {
        var plans = values.All("metric")
            .Select(x => ParseMetric(x, false))
            .Concat(values.All("guardrail").Select(x => ParseMetric(x, true)))
            .ToArray();

        if (plans.Length > 0)
        {
            return plans;
        }

        var metricEvent = GetOptional(values, "metric-event");
        if (string.IsNullOrWhiteSpace(metricEvent))
        {
            return [];
        }

        var control = Get(values, "control-variant", variants[0].Name);
        var treatment = Get(values, "treatment-variant", variants.Length > 1 ? variants[1].Name : variants[0].Name);
        var targets = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
        {
            [control] = GetDouble(values, "control-rate", 0.20),
            [treatment] = GetDouble(values, "treatment-rate", 0.36)
        };

        return [new MetricPlan(metricEvent, "binary", "once", targets, false)];
    }

    private static VariantPlan ParseVariant(string value)
    {
        var parts = SplitPair(value, "variant");
        if (!int.TryParse(parts.Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var users) || users < 0)
        {
            throw new ArgumentException($"Invalid variant user count: {value}");
        }

        return new VariantPlan(parts.Key, users);
    }

    private static VariantPlan WithInsightMapping(
        VariantPlan variant,
        IReadOnlyDictionary<string, string> variationIds,
        IReadOnlyDictionary<string, string> variationValues)
    {
        return variant with
        {
            InsightId = variationIds.GetValueOrDefault(variant.Name, variant.Name),
            InsightValue = variationValues.GetValueOrDefault(variant.Name, variant.Name)
        };
    }

    private static IReadOnlyDictionary<string, string> ParseStringMap(IEnumerable<string> values)
    {
        return values
            .Select(x => SplitPair(x, "variation mapping"))
            .ToDictionary(x => x.Key, x => x.Value, StringComparer.OrdinalIgnoreCase);
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

    private static DateOnly? GetDate(ArgBag values, string key)
    {
        var value = GetOptional(values, key);
        return string.IsNullOrWhiteSpace(value)
            ? null
            : DateOnly.ParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private static DateOnly? GetStartUtcDate(ArgBag values)
    {
        var value = GetOptional(values, "start-utc");
        return string.IsNullOrWhiteSpace(value)
            ? null
            : DateOnly.FromDateTime(DateTimeOffset.Parse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal).UtcDateTime);
    }

    private static string Get(ArgBag values, string key, string fallback) =>
        GetOptional(values, key) is { Length: > 0 } value ? value : fallback;

    private static string? GetOptional(ArgBag values, string key) => values.Last(key);

    private static int GetInt(ArgBag values, string key, int fallback)
    {
        var value = GetOptional(values, key);
        return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : fallback;
    }

    private static double GetDouble(ArgBag values, string key, double fallback)
    {
        var value = GetOptional(values, key);
        return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : fallback;
    }

    private static double ParseDouble(string value, string message)
    {
        return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : throw new ArgumentException(message);
    }
}

sealed record VariantPlan(string Name, int Users)
{
    public string InsightId { get; init; } = Name;
    public string InsightValue { get; init; } = Name;
}

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
