using System.Buffers.Binary;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace UiExperimentData;

public sealed record MetricSpec(string Key, string Type, string Agg, string Direction, string Distribution, double[] A, double[]? B = null)
{
    public bool Inverse => Direction is "increase_bad" or "decrease_good";
}

public sealed record Scenario(string Id, string ExperimentName, string FlagKey, string ValueType, string[] Values,
    int MainUsers, int PhaseAUsers, int PhaseBUsers, bool Checkpoint600, string? LayerKey, double SliceStart, double SliceEnd, MetricSpec[] Metrics)
{
    public bool Bandit => PhaseAUsers > 0;
    public bool Eligible(string userKey) => string.IsNullOrEmpty(LayerKey) || LayerBucket(LayerKey, userKey) is var b && b >= SliceStart && b < SliceEnd;
    public static double LayerBucket(string layer, string user) => Math.Abs(BinaryPrimitives.ReadInt32LittleEndian(MD5.HashData(Encoding.UTF8.GetBytes(layer + user))) / -2147483648d) * 100;
}

public static class Catalog
{
    public static Scenario[] Load(string path = "")
    {
        var text = path.Length > 0 ? File.ReadAllText(path) : new StreamReader(Assembly.GetExecutingAssembly().GetManifestResourceStream("UiExperimentData.scenarios.json")!).ReadToEnd();
        var cases = JsonSerializer.Deserialize<Scenario[]>(text, Json.Options) ?? [];
        Validate(cases);
        return cases;
    }
    public static void Validate(Scenario[] cases)
    {
        if (cases.Length == 0 || cases.Select(c => c.Id).Distinct().Count() != cases.Length || cases.Select(c => c.FlagKey).Distinct().Count() != cases.Length)
            throw new Stop("Scenario IDs and flag keys must be unique.");
        foreach (var c in cases)
        {
            Cli.SafeId(c.Id);
            if (c.Values.Length is < 2 or > 3 || c.Values.Distinct().Count() != c.Values.Length || c.ValueType is not ("boolean" or "string") || c.Metrics.Length != 3 || c.Metrics.Select(m => m.Key).Distinct().Count() != 3)
                throw new Stop("Invalid scenario roles/metrics: " + c.Id);
            if (c.MainUsers < 0 || c.PhaseAUsers < 0 || c.PhaseBUsers < 0 || (c.Bandit ? c.MainUsers != 0 || c.PhaseAUsers < 150 || c.PhaseBUsers == 0 : c.MainUsers == 0 || c.PhaseBUsers != 0) || (c.Checkpoint600 && c.PhaseAUsers < 600))
                throw new Stop("Invalid batch sizes: " + c.Id);
            if (c.SliceStart < 0 || c.SliceEnd > 100 || c.SliceEnd <= c.SliceStart) throw new Stop("Invalid layer slice.");
            foreach (var m in c.Metrics)
                if (m.Type is not ("binary" or "numeric") || m.Agg is not ("once" or "count" or "sum" or "average") || (m.Type == "binary" && m.Agg != "once") ||
                    m.Direction is not ("increase_good" or "decrease_good" or "increase_bad" or "decrease_bad") ||
                    m.Distribution is not ("once" or "poisson" or "sum" or "tail" or "average" or "average-guard") ||
                    m.A.Length != c.Values.Length || (m.B != null && m.B.Length != c.Values.Length) ||
                    (m.Agg switch { "once" => m.Distribution != "once", "count" => m.Distribution != "poisson", "sum" => m.Distribution is not ("sum" or "tail"), _ => m.Distribution is not ("average" or "average-guard") }) ||
                    m.A.Concat(m.B ?? []).Any(x => !double.IsFinite(x) || x < 0 || x > (m.Distribution == "once" ? 1 : m.Distribution == "poisson" ? 20 : 10000)))
                    throw new Stop("Invalid metric distribution: " + m.Key);
        }
    }
    public static Scenario Find(Scenario[] cases, string id) => cases.SingleOrDefault(c => c.Id == id) ?? throw new Stop("Unknown case: " + id);
}

public sealed record BatchPlan(string Id, string Phase, int Offset, int NewUsers, string? Previous, bool Diagnostic)
{
    public static BatchPlan For(Scenario c, string batch) => batch switch
    {
        "main" when !c.Bandit => new(batch, "main", 0, c.MainUsers, null, false),
        "a-150" when c.Bandit => new(batch, "a", 0, 150, null, false),
        "a-600" when c.Checkpoint600 => new(batch, "a", 150, 450, "a-150", false),
        "a-full" when c.Bandit => new(batch, "a", c.Checkpoint600 ? 600 : 150, c.PhaseAUsers - (c.Checkpoint600 ? 600 : 150), c.Checkpoint600 ? "a-600" : "a-150", false),
        "b" when c.Bandit => new(batch, "b", 0, c.PhaseBUsers, "a-full", false),
        "probe-zero-events" => new(batch, batch, 0, 32, null, true),
        "probe-zero-control" when c.Id == "bayesian-binary" => new(batch, batch, 0, 64, null, true),
        "probe-constant" when c.Id == "bayesian-average" => new(batch, batch, 0, 64, null, true),
        "probe-attribution" when c.Id == "bayesian-count" => new(batch, batch, 0, 32, null, true),
        "probe-layer" when c.Id is "bayesian-count" or "bandit-sum" => new(batch, batch, 0, 60, null, true),
        _ => throw new Stop("Unsupported batch for this case.")
    };
}

public static class Generator
{
    public static string[] Users(Scenario c, BatchPlan batch, string session)
    {
        var result = new List<string>();
        var eligible = 0;
        for (var candidate = 0; candidate < (batch.Offset + batch.NewUsers) * 1000 + 1000; candidate++)
        {
            var scope = batch.Id == "probe-layer" ? "layer-isolation" : c.Id;
            var key = $"ui-e2e-{session}-{scope}-{batch.Phase}-{candidate:D6}";
            if (batch.Id != "probe-layer" && !c.Eligible(key)) continue;
            if (eligible++ < batch.Offset) continue;
            result.Add(key);
            if (result.Count == batch.NewUsers) return result.ToArray();
        }
        throw new Stop("Unable to obtain the planned Layer-eligible users.");
    }
    public static double[] Values(MetricSpec m, int variant, string phase, string userKey, int seed)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{seed}|{userKey}|{m.Key}|{phase}"));
        var random = new Random(BinaryPrimitives.ReadInt32LittleEndian(bytes));
        var mean = (phase == "b" ? m.B ?? m.A : m.A)[variant];
        var u = random.NextDouble();
        var index = random.Next(4);
        return m.Distribution switch
        {
            "once" => u >= mean ? [] : index switch { 0 => [0], 1 => [1], 2 => [1, 10], _ => [0, 10, 100] },
            "poisson" => Enumerable.Range(0, Poisson(random, mean)).Select(i => new double[] { 0, 1, 10, 100 }[i % 4]).ToArray(),
            "sum" => index switch { 0 => [], 1 => [0.5 * mean], 2 => [0.5 * mean, mean], _ => [mean, mean] },
            "tail" => u < .25 ? [] : u < .75 ? [.4 * mean, .6 * mean] : u < .99 ? [.5 * mean, mean] : [4 * mean, 10 * mean],
            "average" => index switch { 0 => [], 1 => [mean], 2 => [mean, 1.4 * mean], _ => [1.4 * mean, 1.8 * mean, 2.2 * mean] },
            "average-guard" => index switch { 0 => [], 1 => [mean], 2 => [.5 * mean, 1.5 * mean], _ => [1.5 * mean, 2 * mean, 2.5 * mean] },
            _ => throw new Stop("Unknown distribution.")
        };
    }
    private static int Poisson(Random random, double lambda)
    {
        // Add independent Poisson variables to avoid exp(-lambda) underflow.
        if (lambda > 20) return Poisson(random, 20) + Poisson(random, lambda - 20);
        var p = 1d; var count = 0; var limit = Math.Exp(-lambda);
        do { p *= random.NextDouble(); count++; } while (p > limit);
        return count - 1;
    }
}
