using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;
using Microsoft.Extensions.Logging;
using System.Text.Json.Nodes;

namespace UiExperimentData;

public sealed class SdkDiagnostics : ILoggerFactory
{
    private int failures;
    public int Failures => Volatile.Read(ref failures);
    public ILogger CreateLogger(string categoryName) => new Sink(this);
    public void AddProvider(ILoggerProvider provider) { }
    public void Dispose() { }
    private sealed class Sink(SdkDiagnostics owner) : ILogger
    {
        public IDisposable BeginScope<TState>(TState state) => new Scope();
        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Warning;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        { if (IsEnabled(logLevel)) Interlocked.Increment(ref owner.failures); }
        private sealed class Scope : IDisposable { public void Dispose() { } }
    }
}

public sealed class SdkGateway : IAsyncDisposable
{
    private readonly FbClient live;
    private readonly FbClient mirror;
    private readonly ILoggerFactory loggers;
    private readonly SdkDiagnostics diagnostics = new();
    public static FbUser User(string key, string session, string phase) => FbUser.Builder(key).Name("UI experiment test user")
        .Custom("expt_simulator", "ui-sdk-e2e-v1").Custom("simulation_batch", session).Custom("simulation_phase", phase).Build();
    public SdkGateway(Settings settings, string sdkKey, Target[] targets)
    {
        loggers = diagnostics;
        mirror = Mirror(targets.Select(t => t.Flag));
        live = new FbClient(new FbOptionsBuilder(sdkKey).Streaming(new Uri(settings.StreamingUrl)).Event(new Uri(settings.EventUrl))
            .StartWaitTime(TimeSpan.FromSeconds(15)).AutoFlushInterval(TimeSpan.FromSeconds(1)).MaxEventsInQueue(20000)
            .MaxEventPerRequest(500).MaxSendEventAttempts(1).LoggerFactory(loggers).Build());
    }
    public static string Bootstrap(IEnumerable<JsonObject> flags)
    {
        var array = new JsonArray();
        foreach (var f in flags)
        {
            var copy = f.DeepClone().AsObject(); copy["version"] = f["committedVersion"]?.DeepClone() ?? JsonValue.Create(1L);
            array.Add(copy);
        }
        return new JsonObject { ["messageType"] = "data-sync", ["data"] = new JsonObject { ["eventType"] = "full", ["featureFlags"] = array, ["segments"] = new JsonArray() } }.ToJsonString();
    }
    public static FbClient Mirror(IEnumerable<JsonObject> flags) => new(new FbOptionsBuilder("offline-reference")
        .Offline(true).UseJsonBootstrapProvider(Bootstrap(flags)).Build());
    public void Ready()
    {
        if (!live.Initialized || live.Status != FbClientStatus.Ready) throw new Stop("SDK is not ready; no fallback evaluations are allowed.");
        if (diagnostics.Failures > 0) throw new Stop("SDK reported a transport/queue warning or error; inspect server health before retrying.", 3);
    }
    public async Task<string> Synchronize(Target[] targets, string session)
    {
        var until = DateTimeOffset.UtcNow.AddSeconds(15);
        while (DateTimeOffset.UtcNow < until)
        {
            Ready();
            var matches = true;
            for (var i = 0; i < 512 && matches; i++)
            {
                var user = User($"ui-config-probe-{session}-{i:D4}", session, "preflight");
                var expected = mirror.GetAllVariations(user).ToDictionary(x => x.Key);
                var actual = live.GetAllVariations(user).ToDictionary(x => x.Key);
                matches = targets.All(t => actual.TryGetValue(Json.Text(t.Flag["key"]), out var a) && expected.TryGetValue(a.Key, out var e) &&
                    a.ValueId == e.ValueId && a.Value == e.Value && a.Kind == e.Kind && a.Reason == e.Reason);
            }
            if (matches) return $"FeatBit.ServerSdk 1.2.11: ready; 512 event-free GetAllVariations probes agree with an offline official-SDK evaluation of frozen management snapshots. Actual injected users are checked too. This is behavioral evidence, not an SDK revision API.";
            await Task.Delay(250);
        }
        throw new Stop("SDK behavior does not match the saved targeting snapshot. Wait for synchronization; no users were selected by variant.");
    }
    public ExposureCall Evaluate(Scenario c, Target target, FbUser user)
    {
        Ready();
        var expected = mirror.GetAllVariations(user).SingleOrDefault(v => v.Key == c.FlagKey) ?? throw new Stop("Reference SDK snapshot did not contain the target flag.");
        var at = Clock.Now();
        string id, value, kind, reason;
        if (c.ValueType == "boolean")
        {
            var d = live.BoolVariationDetail(c.FlagKey, user, false);
            id = d.ValueId; value = d.Value ? "true" : "false"; kind = d.Kind.ToString(); reason = d.Reason;
        }
        else
        {
            var d = live.StringVariationDetail(c.FlagKey, user, "__ui_data_fallback__");
            id = d.ValueId; value = d.Value; kind = d.Kind.ToString(); reason = d.Reason;
        }
        if (string.IsNullOrEmpty(id) || !target.VariationIds.TryGetValue(value, out var wantedId) || wantedId != id ||
            expected.ValueId != id || expected.Value != value || expected.Kind.ToString() != kind || expected.Reason != reason)
            throw new Stop("SDK fallback, wrong variant, rule mismatch or configuration change during evaluation. Delivery is uncertain; do not replay.", 3);
        return new(c.Id, id, value, at, c.Eligible(user.Key));
    }
    public MetricCall Track(FbUser user, string key, double value)
    {
        Ready(); if (!double.IsFinite(value)) throw new Stop("Refusing a non-finite metric value.");
        var at = Clock.Now(); live.Track(user, key, value); return new(key, value, at);
    }
    public void Flush()
    {
        if (!live.FlushAndWait(TimeSpan.FromSeconds(30))) throw new Stop("SDK flush timed out; delivery is uncertain. Do not replay this batch.", 3);
        Ready();
    }
    public async ValueTask DisposeAsync()
    {
        try
        {
            await live.CloseAsync(); await mirror.CloseAsync();
            if (diagnostics.Failures > 0) throw new Stop("SDK reported a send failure while closing; delivery is uncertain.", 3);
        }
        finally { loggers.Dispose(); }
    }
}

public static class Clock
{
    // SDK timestamps have millisecond precision. Ledger times record call boundaries.
    public static DateTimeOffset Now() => DateTimeOffset.FromUnixTimeMilliseconds(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    public static DateTimeOffset FloorMinute(DateTimeOffset time) => DateTimeOffset.FromUnixTimeSeconds(time.ToUnixTimeSeconds() / 60 * 60);
    public static async Task<DateTimeOffset> NextMinute(CancellationToken token = default)
    {
        var boundary = FloorMinute(DateTimeOffset.UtcNow).AddMinutes(1);
        await Task.Delay(boundary - DateTimeOffset.UtcNow + TimeSpan.FromMilliseconds(20), token);
        return boundary;
    }
}
