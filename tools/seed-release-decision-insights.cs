#:package FeatBit.ServerSdk@1.2.11

using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Evaluation;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

if (args.Any(x => x is "--help" or "-h"))
{
    SeedOptions.PrintUsage();
    return;
}

// FeatBit.ServerSdk 1.2.11 uses reflection-based System.Text.Json
// deserialization for streaming data-sync. .NET file-based apps disable it
// by default, unlike normal console projects.
AppContext.SetSwitch("System.Text.Json.JsonSerializer.IsReflectionEnabledByDefault", true);

var options = SeedOptions.Parse(args);
var users = BuildUsers(options).ToArray();

var sdkOptions = new FbOptionsBuilder(options.EnvSecret)
    .Streaming(new Uri(options.StreamingUrl))
    .Event(new Uri(options.EventUrl))
    .StartWaitTime(TimeSpan.FromSeconds(options.StartWaitSeconds))
    .MaxEventPerRequest(options.BatchSize)
    .DisableEvents(options.DryRun)
    .Build();

var client = new FbClient(sdkOptions);

try
{
    if (!client.Initialized)
    {
        throw new InvalidOperationException(
            $"FeatBit SDK did not initialize. Status: {client.Status}. Check --streaming-url, --event-url, and --env-secret.");
    }

    var evaluatedUsers = EvaluateUsers(client, options, users);
    var metricEvents = BuildMetricEvents(options, evaluatedUsers).ToArray();

    if (!options.DryRun)
    {
        TrackMetrics(client, metricEvents);

        if (!client.FlushAndWait(TimeSpan.FromSeconds(options.FlushTimeoutSeconds)))
        {
            throw new TimeoutException(
                $"Timed out after {options.FlushTimeoutSeconds} seconds while flushing FeatBit SDK events.");
        }
    }

    Console.WriteLine(options.DryRun
        ? $"Dry run: evaluated {evaluatedUsers.Length} users and planned {metricEvents.Length} metric events."
        : $"Seeded {evaluatedUsers.Length} evaluated users and {metricEvents.Length} metric events through FeatBit .NET Server SDK.");

    Console.WriteLine($"Flag: {options.FlagKey}");
    Console.WriteLine($"Flag type: {options.FlagType}");
    Console.WriteLine($"Event URL: {options.EventUrl}");
    Console.WriteLine($"Streaming URL: {options.StreamingUrl}");
    Console.WriteLine($"Users: {options.Users}");
    Console.WriteLine($"Seed: {options.Seed}");
    Console.WriteLine("Actual variation split:");

    foreach (var group in evaluatedUsers
                 .GroupBy(x => x.Variation.Id)
                 .OrderByDescending(x => x.Count())
                 .ThenBy(x => x.Key, StringComparer.Ordinal))
    {
        var sample = group.First().Variation;
        Console.WriteLine(
            $"  {sample.Label}: {group.Count()} users ({group.Count() * 100.0 / evaluatedUsers.Length:0.##}%)");
    }

    Console.WriteLine($"Metrics: {string.Join(", ", options.Metrics.Select(x => x.ToSummary()))}");
}
finally
{
    await client.CloseAsync();
}

static IEnumerable<SeedUser> BuildUsers(SeedOptions options)
{
    for (var index = 0; index < options.Users; index++)
    {
        var key = StableUserKey(options.UserPrefix, options.Seed, index);
        yield return new SeedUser(key);
    }
}

static EvaluatedUser[] EvaluateUsers(FbClient client, SeedOptions options, SeedUser[] users)
{
    var evaluated = new List<EvaluatedUser>(users.Length);

    foreach (var user in users)
    {
        var fbUser = ToFbUser(user);
        evaluated.Add(new EvaluatedUser(user, fbUser, EvaluateFlagVariation(client, options, fbUser)));
    }

    return evaluated.ToArray();
}

static FbUser ToFbUser(SeedUser user) =>
    FbUser.Builder(user.Key)
        .Name(user.Key)
        .Build();

static EvaluatedVariation EvaluateFlagVariation(FbClient client, SeedOptions options, FbUser user)
{
    return options.FlagType switch
    {
        "bool" => FromEvalDetail(
            options,
            user,
            client.BoolVariationDetail(options.FlagKey, user, defaultValue: false),
            value => value ? "true" : "false"),
        "string" => FromEvalDetail(
            options,
            user,
            client.StringVariationDetail(options.FlagKey, user, defaultValue: string.Empty),
            value => value),
        "int" => FromEvalDetail(
            options,
            user,
            client.IntVariationDetail(options.FlagKey, user, defaultValue: 0),
            value => value.ToString(CultureInfo.InvariantCulture)),
        "double" => FromEvalDetail(
            options,
            user,
            client.DoubleVariationDetail(options.FlagKey, user, defaultValue: 0),
            value => value.ToString(CultureInfo.InvariantCulture)),
        "float" => FromEvalDetail(
            options,
            user,
            client.FloatVariationDetail(options.FlagKey, user, defaultValue: 0),
            value => value.ToString(CultureInfo.InvariantCulture)),
        _ => throw new ArgumentException($"Unsupported flag type: {options.FlagType}")
    };
}

static EvaluatedVariation FromEvalDetail<T>(
    SeedOptions options,
    FbUser user,
    EvalDetail<T> detail,
    Func<T, string> valueFormatter)
{
    if (string.IsNullOrWhiteSpace(detail.ValueId))
    {
        throw new InvalidOperationException(
            $"Flag '{options.FlagKey}' evaluated user '{user.Key}' without a variation id. " +
            $"Kind: {detail.Kind}. Reason: {detail.Reason}");
    }

    return new EvaluatedVariation(detail.ValueId, valueFormatter(detail.Value));
}

static void TrackMetrics(FbClient client, MetricEmission[] metricEvents)
{
    foreach (var metric in metricEvents)
    {
        client.Track(metric.User, metric.EventName, metric.NumericValue);
    }
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
                 .GroupBy(x => x.Variation.Id)
                 .OrderBy(x => x.Key, StringComparer.Ordinal))
    {
        var users = group.OrderBy(x => x.SeedUser.Key, StringComparer.Ordinal).ToArray();
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
            yield return new MetricEmission(users[index].FbUser, metric.Event, 1);
        }

        yield break;
    }

    switch (metric.Agg)
    {
        case "count":
            var eventCount = (int)Math.Round(target, MidpointRounding.AwayFromZero);
            for (var slot = 0; slot < eventCount; slot++)
            {
                yield return new MetricEmission(users[slot % users.Length].FbUser, metric.Event, 1);
            }
            break;

        case "sum":
            foreach (var user in users)
            {
                yield return new MetricEmission(user.FbUser, metric.Event, target / users.Length);
            }
            break;

        case "average":
            foreach (var user in users)
            {
                yield return new MetricEmission(user.FbUser, metric.Event, target);
            }
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

sealed record SeedOptions(
    string EventUrl,
    string StreamingUrl,
    string EnvSecret,
    string FlagKey,
    string FlagType,
    int Users,
    MetricPlan[] Metrics,
    int Seed,
    int BatchSize,
    int StartWaitSeconds,
    int FlushTimeoutSeconds,
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

        var eventUrl = NormalizeBaseUrl(Get(values, "event-url", Get(values, "evaluation-url", "http://localhost:5100")));
        var streamingUrl = NormalizeBaseUrl(Get(values, "streaming-url", ToStreamingUrl(eventUrl)));

        return new SeedOptions(
            eventUrl,
            streamingUrl,
            envSecret,
            Get(values, "flag-key", "pricing-self-host-value-prop"),
            NormalizeFlagType(Get(values, "flag-type", "bool")),
            GetInt(values, "users", 3000, min: 1),
            metrics,
            GetInt(values, "seed", 20260604),
            GetInt(values, "batch-size", 100, min: 1),
            GetInt(values, "start-wait-seconds", 10, min: 1),
            GetInt(values, "flush-timeout-seconds", 30, min: 1),
            Get(values, "user-prefix", "rd-seed"),
            dryRun);
    }

    public static void PrintUsage()
    {
        Console.WriteLine("""
        Seeds FeatBit release-decision insights through FeatBit .NET Server SDK.

        The tool only generates stable synthetic user keyIds. It initializes
        the FeatBit Server SDK, evaluates the configured flag for each user,
        lets live targeting and rollout choose the variation, then emits metric
        events through SDK Track with the same user keyId.

        Example:
          dotnet run tools/seed-release-decision-insights.cs -- \
            --env-secret <server-sdk-secret> \
            --event-url http://localhost:5100 \
            --streaming-url ws://localhost:5100 \
            --flag-key pricing-self-host-value-prop \
            --flag-type bool \
            --users 3000 \
            --metric self_host_high_intent_cta_clicked:binary:once:true=0.04,false=0.055

        Metric format:
          --metric <event>:<binary|continuous>:<once|count|sum|average>:<variation=target,...>
          --guardrail uses the same format.

        Variation target keys:
          Use either the real variation value or the real variation id returned
          by SDK evaluation detail. Boolean variation values are matched as
          lower-case true/false.

        SDK endpoints:
          --event-url is the FeatBit evaluation/event server base URL.
          --streaming-url defaults to --event-url with http/https converted to
          ws/wss. The old --evaluation-url option is still accepted as an alias
          for --event-url.

        Release-decision evidence:
          The tool does not send experiment or run ids. The featbit-api provider
          attributes SDK evaluation and track events to the active collecting
          release-decision run for the evaluated flag, user, event name, and
          observation window.

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

    private static string NormalizeFlagType(string value)
    {
        return value.ToLowerInvariant() switch
        {
            "bool" or "boolean" => "bool",
            "string" => "string",
            "int" or "integer" => "int",
            "double" or "number" => "double",
            "float" => "float",
            _ => throw new ArgumentException($"Unsupported flag type: {value}")
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

    private static string NormalizeBaseUrl(string value)
    {
        var uri = new Uri(value);
        return uri.ToString().TrimEnd('/');
    }

    private static string ToStreamingUrl(string eventUrl)
    {
        var builder = new UriBuilder(eventUrl);
        builder.Scheme = builder.Scheme switch
        {
            "http" => "ws",
            "https" => "wss",
            "ws" or "wss" => builder.Scheme,
            _ => throw new ArgumentException($"Cannot derive streaming URL from scheme '{builder.Scheme}'. Use --streaming-url.")
        };

        return builder.Uri.ToString().TrimEnd('/');
    }
}

sealed record SeedUser(string Key);

sealed record EvaluatedUser(SeedUser SeedUser, FbUser FbUser, EvaluatedVariation Variation);

sealed record EvaluatedVariation(string Id, string Value)
{
    public string Label => string.IsNullOrWhiteSpace(Value)
        ? Id
        : $"{Value} ({Id})";
}

sealed record MetricEmission(FbUser User, string EventName, double NumericValue);

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
