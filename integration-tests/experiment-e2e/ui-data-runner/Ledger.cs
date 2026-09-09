using System.Text.Json;
using System.Text.Json.Nodes;

namespace UiExperimentData;

public sealed record ExposureCall(string CaseId, string VariationId, string Value, DateTimeOffset At, bool Eligible);
public sealed record MetricCall(string Key, double Value, DateTimeOffset At);
public sealed class UserRecord
{
    public string UserKey { get; set; } = "";
    public string Phase { get; set; } = "";
    public bool Diagnostic { get; set; }
    public List<ExposureCall> Exposures { get; set; } = [];
    public List<MetricCall> Metrics { get; set; } = [];
}
public sealed class Stat
{
    public long Users { get; set; }
    public long Conversions { get; set; }
    public double Sum { get; set; }
    public double SumSquares { get; set; }
    public double Mean => Users == 0 ? 0 : Sum / Users;
}
public static class Ledger
{
    public static Dictionary<string, Dictionary<string, Stat>> Aggregate(Scenario c, IReadOnlyDictionary<string, string> ids, IEnumerable<UserRecord> records, DateTimeOffset start, DateTimeOffset end)
    {
        var result = c.Metrics.ToDictionary(m => m.Key, _ => ids.Values.ToDictionary(id => id, _ => new Stat()));
        foreach (var group in records.GroupBy(r => r.UserKey))
        {
            var exposure = group.SelectMany(r => r.Exposures).Where(e => e.CaseId == c.Id && e.Eligible && e.At >= start && e.At < end).OrderBy(e => e.At).FirstOrDefault();
            if (exposure == null) continue;
            if (!ids.Values.Contains(exposure.VariationId)) throw new Stop("Unknown variation in ledger.");
            foreach (var metric in c.Metrics)
            {
                var values = group.SelectMany(r => r.Metrics).Where(e => e.Key == metric.Key && e.At >= start && e.At < end && e.At >= exposure.At).Select(e => e.Value).ToArray();
                if (values.Any(v => !double.IsFinite(v))) throw new Stop("Non-finite metric in ledger.");
                var stat = result[metric.Key][exposure.VariationId];
                var contribution = Contribution(metric.Agg, values);
                stat.Users++; if (values.Length > 0) stat.Conversions++;
                stat.Sum += contribution; stat.SumSquares += contribution * contribution;
            }
        }
        return result;
    }
    public static double Contribution(string agg, double[] values) => values.Length == 0 ? 0 : agg switch
    { "once" => 1, "count" => values.Length, "sum" => values.Sum(), "average" => values.Average(), _ => throw new Stop("Unknown aggregation.") };
    // Chi-square p-value for fixed-stage traffic checks, separate from experiment effect analysis.
    public static double Srm(long[] counts, double[] weights)
    {
        if (counts.Length != weights.Length || weights.Any(p => !double.IsFinite(p) || p <= 0) || Math.Abs(weights.Sum() - 1) > 1e-8)
            throw new Stop("Invalid SRM weights.");
        var n = counts.Sum(); if (n == 0) return 1;
        var chi = counts.Select((v, i) => Math.Pow(v - n * weights[i], 2) / (n * weights[i])).Sum();
        if (counts.Length == 3) return Math.Exp(-chi / 2);
        if (counts.Length != 2) throw new Stop("SRM supports two or three variants.");
        if (chi == 0) return 1;
        var t = 1 / (1 + .2316419 * Math.Sqrt(chi));
        return 2 * Math.Exp(-chi / 2) / Math.Sqrt(2 * Math.PI) * t *
            (.319381530 + t * (-.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    }
}

public sealed class Target
{
    public string CaseId { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string EnvId { get; set; } = "";
    public string ExperimentId { get; set; } = "";
    public string RunId { get; set; } = "";
    public Dictionary<string, string> VariationIds { get; set; } = [];
    public Dictionary<string, double> Weights { get; set; } = [];
    public JsonObject Flag { get; set; } = new();
    public JsonObject Run { get; set; } = new();
    public string ConfigHash { get; set; } = "";
    public string Revision => Json.Text(Flag["revision"]);
}
public sealed class Receipt
{
    public int FormatVersion { get; set; } = 1;
    public string SessionId { get; set; } = "";
    public string CaseId { get; set; } = "";
    public string BatchId { get; set; } = "";
    public string Phase { get; set; } = "";
    public bool Diagnostic { get; set; }
    public string CatalogHash { get; set; } = "";
    public int Seed { get; set; }
    public string Status { get; set; } = "started";
    public int RequestedUsers { get; set; }
    public int RecordedUsers { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset WindowStart { get; set; }
    public DateTimeOffset? WindowEnd { get; set; }
    public Target[] Targets { get; set; } = [];
    public string[] Dependencies { get; set; } = [];
    public string SdkEvidence { get; set; } = "";
    public string LedgerHash { get; set; } = "";
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public JsonNode? PhaseAAnalysis { get; set; }
    public string? Error { get; set; }
}

public sealed class BatchStore
{
    public string Root { get; }
    public BatchStore(string root, string session) { Cli.SafeId(session); Root = Path.Combine(Path.GetFullPath(root), session); }
    public FileStream Lock()
    {
        Directory.CreateDirectory(Root);
        try { return new FileStream(Path.Combine(Root, ".session.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
        catch (IOException) { throw new Stop("Another command is using this session. Wait for it to finish."); }
    }
    public string DirectoryFor(string id, string batch) { Cli.SafeId(id); Cli.SafeId(batch); return Path.Combine(Root, "data", id, batch); }
    public string FileFor(string id, string batch, string name) => Path.Combine(DirectoryFor(id, batch), name);
    public Receipt Read(string id, string batch) => Json.Read<Receipt>(FileFor(id, batch, "receipt.json"));
    public void Save(Receipt receipt) => Json.Write(FileFor(receipt.CaseId, receipt.BatchId, "receipt.json"), receipt);
    public void Reserve(Receipt receipt)
    {
        var dir = DirectoryFor(receipt.CaseId, receipt.BatchId);
        if (Directory.Exists(dir)) throw new Stop("This batch already has an intent or output. Do not replay it. Verify the existing batch or use a new session.");
        Directory.CreateDirectory(dir); Save(receipt);
    }
    public List<UserRecord> Records(string id, string batch)
    {
        var path = FileFor(id, batch, "users.jsonl");
        return File.Exists(path) ? File.ReadLines(path).Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => JsonSerializer.Deserialize<UserRecord>(s, Json.Options) ?? throw new Stop("Invalid ledger.")).ToList() : [];
    }
    public List<UserRecord> Cumulative(Receipt receipt)
    {
        var result = new List<UserRecord>();
        foreach (var batch in receipt.Dependencies.Append(receipt.BatchId))
        {
            var r = Read(receipt.CaseId, batch);
            if (r.Status != "completed") throw new Stop("A required batch has uncertain or incomplete delivery.", 3);
            result.AddRange(Records(receipt.CaseId, batch));
        }
        if (result.Select(r => r.UserKey).Distinct().Count() != result.Count) throw new Stop("Duplicate users across batches.", 1);
        return result;
    }
}

public sealed record CheckResult(string Name, bool Passed, string Detail);
public sealed class Checks
{
    public List<CheckResult> Items { get; set; } = [];
    public bool Passed => Items.All(x => x.Passed);
    public void Add(string name, bool passed, string detail = "") => Items.Add(new(name, passed, detail));
    public void Equal(string name, double actual, double expected, double tolerance = 0)
        => Add(name, double.IsFinite(actual) && Math.Abs(actual - expected) <= Math.Max(tolerance, 1e-9 * Math.Abs(expected)), $"expected={expected:G17}; actual={actual:G17}");
    public void Require() { if (!Passed) throw new Stop(string.Join("; ", Items.Where(x => !x.Passed).Take(5).Select(x => x.Name + ": " + x.Detail)), 1); }
}
