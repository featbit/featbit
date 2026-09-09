using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace UiExperimentData;

public sealed class Stop(string message, int code = 2) : Exception(message)
{
    public int Code { get; } = code;
}

public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    { WriteIndented = true, UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow };
    public static string Text(JsonNode? node) => node is JsonValue v && v.TryGetValue<string>(out var s) ? s : node?.ToJsonString() ?? "";
    public static double Number(JsonNode? node) => node is not JsonValue v ? double.NaN : v.TryGetValue<double>(out var n) ? n : v.TryGetValue<int>(out var i) ? i : v.TryGetValue<long>(out var l) ? l : double.NaN;
    public static bool Bool(JsonNode? node) => node is JsonValue v && v.TryGetValue<bool>(out var b) && b;
    public static JsonObject Object(JsonNode? node) => node as JsonObject ?? new();
    public static JsonArray Array(JsonNode? node) => node as JsonArray ?? new();
    public static JsonNode? ParseField(JsonNode? node) => node is JsonValue v && v.TryGetValue<string>(out var s)
        ? string.IsNullOrWhiteSpace(s) ? null : JsonNode.Parse(s) : node?.DeepClone();
    public static string Hash(object value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value, Options)))).ToLowerInvariant();
    public static T Read<T>(string path) => JsonSerializer.Deserialize<T>(File.ReadAllText(path), Options) ?? throw new Stop($"Empty file: {path}");
    public static void Write(string path, object value)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(value, Options), new UTF8Encoding(false));
        File.Move(temp, path, true);
    }
    public static DateTimeOffset? Date(JsonNode? node) => DateTimeOffset.TryParse(Text(node),
        System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out var d) ? d.ToUniversalTime() : null;
}

public sealed class Cli
{
    public string Action { get; init; } = "help";
    public string Session { get; init; } = "";
    public string Case { get; init; } = "";
    public string Batch { get; init; } = "";
    public string Config { get; init; } = "";
    public string Scenarios { get; init; } = "";
    public string ReportRoot { get; init; } = "";
    public static Cli Parse(string[] args)
    {
        if (args.Length == 0 || args.SequenceEqual(["--help"])) return new();
        var allowed = new[] { "action", "session-id", "case", "batch", "config", "scenarios", "report-root" };
        var values = new Dictionary<string, string>();
        for (var i = 0; i < args.Length; i += 2)
        {
            var key = args[i].StartsWith("--") ? args[i][2..] : "";
            if (!allowed.Contains(key) || i + 1 >= args.Length || args[i + 1].StartsWith("--") || !values.TryAdd(key, args[i + 1]))
                throw new Stop("Unknown, duplicate or incomplete option. Use --help.");
        }
        var cli = new Cli { Action = values.GetValueOrDefault("action", "help"), Session = values.GetValueOrDefault("session-id", ""),
            Case = values.GetValueOrDefault("case", ""), Batch = values.GetValueOrDefault("batch", ""),
            Config = values.GetValueOrDefault("config", ""), Scenarios = values.GetValueOrDefault("scenarios", ""), ReportRoot = values.GetValueOrDefault("report-root", "") };
        if (!new[] { "help", "plan", "preflight", "inject", "verify" }.Contains(cli.Action)) throw new Stop("Unknown action.");
        if (cli.Action is "preflight" or "inject" or "verify") SafeId(cli.Session);
        if (cli.Action is "inject" or "verify") { SafeId(cli.Case); SafeId(cli.Batch); }
        return cli;
    }
    public static void SafeId(string id)
    {
        if (!Regex.IsMatch(id, "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$", RegexOptions.CultureInvariant))
            throw new Stop("Identifiers must have 1..80 ASCII letters, digits, '-' or '_', starting with a letter or digit.");
    }
}

public sealed class Settings
{
    public string ApiUrl { get; set; } = "http://localhost:5000";
    public string EventUrl { get; set; } = "http://localhost:5100";
    public string StreamingUrl { get; set; } = "ws://localhost:5100";
    public string ProjectKey { get; set; } = "e2e-api-ui-e2e-20260904-1417";
    public string ProjectName { get; set; } = "E2E API Project ui-e2e-20260904-1417";
    public string EnvironmentName { get; set; } = "auto-test-001";
    public string EnvId { get; set; } = "";
    public string WorkspaceId { get; set; } = "";
    public string OrganizationId { get; set; } = "";
    public string OrganizationName { get; set; } = "FeatBit";
    public string AuthMode { get; set; } = "bearer";
    public bool AllowRemote { get; set; }
    public int ChunkSize { get; set; } = 100;
    public int IngestionTimeoutSeconds { get; set; } = 60;
    public int Seed { get; set; } = 20260909;
    public string ReportRoot { get; set; } = "";
    public static Settings Load(Cli cli)
    {
        var s = cli.Config.Length == 0 ? new Settings() : Json.Read<Settings>(cli.Config);
        foreach (var property in typeof(Settings).GetProperties().Where(p => p.PropertyType == typeof(string)))
        {
            var envName = "FEATBIT_UI_" + Regex.Replace(property.Name, "([a-z0-9])([A-Z])", "$1_$2").ToUpperInvariant();
            var value = Environment.GetEnvironmentVariable(envName);
            if (!string.IsNullOrWhiteSpace(value)) property.SetValue(s, value);
        }
        if (cli.ReportRoot.Length > 0) s.ReportRoot = cli.ReportRoot;
        if (s.ReportRoot.Length == 0) s.ReportRoot = Path.Combine(Directory.GetCurrentDirectory(), "integration-tests", "experiment-e2e", "reports");
        s.ReportRoot = Path.GetFullPath(s.ReportRoot);
        foreach (var (url, schemes) in new[] { (s.ApiUrl, new[] { "http", "https" }), (s.EventUrl, new[] { "http", "https" }), (s.StreamingUrl, new[] { "ws", "wss" }) })
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || !schemes.Contains(uri.Scheme) || uri.UserInfo.Length > 0 || uri.Query.Length > 0 || (!s.AllowRemote && !uri.IsLoopback))
                throw new Stop("Use explicit local API/Event/Streaming URLs without credentials/query strings. Remote endpoints require allowRemote in the local config.");
        if (s.AuthMode is not ("raw" or "bearer") || s.ChunkSize is < 1 or > 200 || s.IngestionTimeoutSeconds is < 1 or > 600)
            throw new Stop("Invalid authMode, chunkSize (1..200) or ingestionTimeoutSeconds (1..600).");
        if (string.IsNullOrWhiteSpace(s.ProjectKey) || string.IsNullOrWhiteSpace(s.ProjectName) || string.IsNullOrWhiteSpace(s.EnvironmentName)) throw new Stop("Project/environment identity is required.");
        return s;
    }
}
