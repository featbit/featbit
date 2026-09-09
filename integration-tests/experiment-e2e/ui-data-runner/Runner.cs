using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace UiExperimentData;

public sealed class Runner(Cli cli, Settings settings, Scenario[] catalog)
{
    private readonly BatchStore store = new(settings.ReportRoot, cli.Session);
    private readonly string catalogHash = Json.Hash(catalog);
    private static readonly JsonSerializerOptions Lines = new(Json.Options) { WriteIndented = false };
    public async Task Execute()
    {
        using var sessionLock = store.Lock();
        if (cli.Action == "inject" && Directory.Exists(store.DirectoryFor(cli.Case, cli.Batch)))
            throw new Stop("Batch already exists. Verify it; never replay a completed or uncertain batch.");
        var cases = cli.Case == "layer-isolation" ? new[] { Catalog.Find(catalog, "bayesian-count"), Catalog.Find(catalog, "bandit-sum") }
            : cli.Case.Length == 0 ? catalog : new[] { Catalog.Find(catalog, cli.Case) };
        if (cli.Case == "layer-isolation" && cli.Batch != "probe-layer") throw new Stop("layer-isolation only supports probe-layer.");
        if (cli.Batch == "probe-layer" && cli.Case != "layer-isolation") throw new Stop("Use -Case layer-isolation for the shared-user layer probe.");
        if (cli.Action is "inject" or "verify") _ = BatchPlan.For(cases[0], cli.Batch);
        using var api = new ManagementApi(settings); await api.Connect();
        var identity = new { formatVersion = 2, userPoolPolicy = Generator.UserPoolPolicy, cli.Session, api.ProjectId, api.EnvId, settings.ProjectKey, settings.ProjectName,
            settings.EnvironmentName, settings.ApiUrl, settings.EventUrl, settings.StreamingUrl, settings.Seed, catalogHash, sdk = "FeatBit.ServerSdk/1.2.11" };
        var identityFile = Path.Combine(store.Root, "session.json");
        if (File.Exists(identityFile))
        {
            if (!JsonNode.DeepEquals(JsonNode.Parse(File.ReadAllText(identityFile)), JsonSerializer.SerializeToNode(identity, Json.Options)))
                throw new Stop("Session identity/configuration or user-pool policy changed. Preserve existing receipts and use a new session.");
        }
        else Json.Write(identityFile, identity);
        if (cli.Action == "preflight") { await Preflight(api, cases); return; }
        if (cli.Action == "inject") { await Inject(api, cases); return; }
        await Verify(api, cases);
    }
    private async Task Preflight(ManagementApi api, Scenario[] cases)
    {
        var reports = new List<object>(); var targets = new List<Target>(); var errors = new List<string>();
        foreach (var c in cases)
        {
            try
            {
                var target = await api.Resolve(c); targets.Add(target);
                reports.Add(new { c.Id, ready = true, target, plannedMinimum = c.Bandit ? 100 : 500,
                    warning = !c.Bandit && target.Run["minimumSample"]?.GetValue<int>() != 500 ? "Bayesian minimumSample is not 500; the planned insufficient-sample UI case is not configured. No run setting was changed." : "" });
            }
            catch (Stop e) { errors.Add(c.Id + ": " + e.Message); reports.Add(new { c.Id, ready = false, error = e.Message }); }
        }
        var evidence = "";
        if (targets.Count > 0)
        {
            try { await using var sdk = new SdkGateway(settings, api.SdkKey, targets.ToArray()); evidence = await sdk.Synchronize(targets.ToArray(), cli.Session); }
            catch (Stop e) { errors.Add(e.Message); }
        }
        Json.Write(Path.Combine(store.Root, "preflight.json"), new { at = Clock.Now(), passed = errors.Count == 0, reports, sdkEvidence = evidence, errors, suggestedWindowStart = Clock.FloorMinute(Clock.Now()).AddMinutes(1), note = "Set a clean observation start through the UI; keep its end open during collection. Preflight never evaluates exposure or tracks metrics." });
        Console.WriteLine($"Preflight: {targets.Count}/{cases.Length} target configurations validated. Report: {store.Root}");
        if (errors.Count > 0) throw new Stop(string.Join(Environment.NewLine, errors));
    }
    private Receipt Prior(BatchPlan plan)
    {
        var previous = store.Read(cli.Case, plan.Previous!); AssertReceipt(previous);
        var path = store.FileFor(cli.Case, previous.BatchId, "verification-data.json");
        if (!File.Exists(path)) throw new Stop($"Run verify for {previous.BatchId} before advancing.");
        var stamp = JsonNode.Parse(File.ReadAllText(path))!;
        if (!Json.Bool(stamp["passed"]) || Json.Text(stamp["receiptHash"]) != Json.Hash(previous))
            throw new Stop("Previous checkpoint data verification is missing, failed or stale.");
        return previous;
    }
    private void AssertReceipt(Receipt receipt)
    {
        if (receipt.Status != "completed") throw new Stop("Delivery is incomplete or uncertain. Inspect receipt, journal and server ingestion; do not replay this batch.", 3);
        if (receipt.FormatVersion != 2 || receipt.UserPoolPolicy != Generator.UserPoolPolicy ||
            receipt.SessionId != cli.Session || receipt.CatalogHash != catalogHash || receipt.Seed != settings.Seed)
            throw new Stop("Receipt does not match this session/scenario/seed/user-pool policy. Preserve it; never replay an old batch.");
        var records = store.Records(receipt.CaseId, receipt.BatchId);
        if (records.Count != receipt.RecordedUsers || receipt.RecordedUsers != receipt.RequestedUsers || Json.Hash(records) != receipt.LedgerHash)
            throw new Stop("Ledger is incomplete or changed since completion.", 1);
    }
    private static void SameConfig(Target frozen, Target actual, bool includeFlag)
    {
        if (actual.ConfigHash != frozen.ConfigHash || (includeFlag && Json.Hash(frozen.Flag) != Json.Hash(actual.Flag)))
            throw new Stop("Flag or experiment configuration changed during a fixed stage. Start a new session after inspecting this batch.");
    }
    private async Task Inject(ManagementApi api, Scenario[] cases)
    {
        var plan = BatchPlan.For(cases[0], cli.Batch);
        var targets = new List<Target>(); foreach (var c in cases) targets.Add(await api.Resolve(c));
        var previous = plan.Previous == null ? null : Prior(plan);
        if (previous != null)
            foreach (var t in targets) SameConfig(previous.Targets.Single(p => p.CaseId == t.CaseId), t, plan.Phase != "b");
        foreach (var (t, c) in targets.Zip(cases))
        {
            if (!plan.Diagnostic && plan.Phase != "b")
            {
                var desired = c.Bandit ? new[] { .7, .15, .15 } : new[] { .5, .5 };
                if (c.Values.Where((v, i) => Math.Abs(t.Weights[t.VariationIds[v]] - desired[i]) > 1e-8).Any())
                    throw new Stop("Initial default split must be " + string.Join("/", desired.Select(v => v * 100)) + ".");
            }
            if (!plan.Diagnostic && (Json.Date(t.Run["observationStart"]) is not { } start || start > Clock.Now() || Json.Date(t.Run["observationEnd"]) != null))
                throw new Stop("Save an observation start at or before now and leave the end open in the UI before injecting a main batch.");
        }
        var phaseAAnalysis = plan.Phase == "b" ? await CheckRecommendations(api, targets[0], previous!) : null;
        var windowStart = plan.Diagnostic ? await Clock.NextMinute() : Json.Date(targets[0].Run["observationStart"])!.Value;
        if (previous != null && windowStart != previous.WindowStart) throw new Stop("Observation start changed between checkpoints.");
        var receipt = new Receipt { UserPoolPolicy = Generator.UserPoolPolicy, SessionId = cli.Session, CaseId = cli.Case, BatchId = cli.Batch, Phase = plan.Phase, Diagnostic = plan.Diagnostic,
            CatalogHash = catalogHash, Seed = settings.Seed, RequestedUsers = plan.NewUsers, StartedAt = Clock.Now(), WindowStart = windowStart,
            Targets = targets.ToArray(), PhaseAAnalysis = phaseAAnalysis, Dependencies = previous == null ? [] : previous.Dependencies.Append(previous.BatchId).ToArray() };
        var oldRecords = previous == null ? new List<UserRecord>() : store.Cumulative(previous);
        foreach (var dependency in receipt.Dependencies) AssertReceipt(store.Read(cli.Case, dependency));
        // A clean window or exact previous ledger is required. Never adopt existing server counts as expected data.
        var baseline = await Query(api, cases, receipt, oldRecords, Clock.Now()); baseline.Checks.Require();
        store.Reserve(receipt);
        Json.Write(store.FileFor(cli.Case, cli.Batch, "baseline.json"), baseline.Observed);
        var records = new List<UserRecord>(); var pending = new List<UserRecord>(); SdkGateway? sdk = null;
        try
        {
            sdk = new SdkGateway(settings, api.SdkKey, receipt.Targets);
            receipt.SdkEvidence = await sdk.Synchronize(receipt.Targets, cli.Session); store.Save(receipt);
            var users = Generator.Users(cases[0], plan, cli.Session);
            if (oldRecords.Select(r => r.UserKey).Intersect(users).Any()) throw new Stop("User pools overlap.");
            using var journal = Writer("journal.jsonl"); using var ledger = Writer("users.jsonl");
            foreach (var chunk in users.Chunk(settings.ChunkSize))
            {
                await CheckFlags(api, receipt);
                // A durable intent comes before any SDK call. A crash here is deliberately not replayable.
                WriteLine(journal, new { state = "attempting", users = chunk, at = Clock.Now() });
                var rows = chunk.Select(key => new UserRecord { UserKey = key, Phase = plan.Phase, Diagnostic = plan.Diagnostic }).ToList();
                pending = rows;
                if (cli.Batch == "probe-attribution")
                {
                    foreach (var row in rows.Where(r => Array.IndexOf(users, r.UserKey) < 16)) row.Metrics.Add(sdk.Track(SdkGateway.User(row.UserKey, cli.Session, plan.Phase), cases[0].Metrics[0].Key, 10));
                    sdk.Flush(); await Task.Delay(5);
                }
                foreach (var row in rows)
                {
                    var user = SdkGateway.User(row.UserKey, cli.Session, plan.Phase);
                    foreach (var (target, c) in receipt.Targets.Zip(cases)) row.Exposures.Add(sdk.Evaluate(c, target, user));
                    if (cli.Batch == "probe-zero-events" && Array.IndexOf(users, row.UserKey) < 16)
                        for (var repeat = 0; repeat < 2; repeat++) row.Exposures.Add(sdk.Evaluate(cases[0], receipt.Targets[0], user));
                }
                WriteLine(journal, new { state = "exposures-enqueued", rows, at = Clock.Now() });
                sdk.Flush(); await Task.Delay(5);
                foreach (var row in rows)
                {
                    var user = SdkGateway.User(row.UserKey, cli.Session, plan.Phase);
                    if (cli.Batch == "probe-layer")
                    {
                        foreach (var key in cases.Select(c => c.Metrics[0].Key).Distinct()) row.Metrics.Add(sdk.Track(user, key, 2));
                        foreach (var key in cases.SelectMany(c => c.Metrics.Skip(1)).Select(m => m.Key).Distinct()) row.Metrics.Add(sdk.Track(user, key, 1));
                    }
                    else
                    {
                        var c = cases[0]; var variant = Array.IndexOf(c.Values, row.Exposures[0].Value);
                        foreach (var (metric, index) in c.Metrics.Select((m, i) => (m, i)))
                            foreach (var value in Values(c, metric, index, variant, plan, row.UserKey, Array.IndexOf(users, row.UserKey)))
                                row.Metrics.Add(sdk.Track(user, metric.Key, value));
                    }
                }
                WriteLine(journal, new { state = "metrics-enqueued", rows, at = Clock.Now() });
                sdk.Flush();
                records.AddRange(rows);
                foreach (var row in rows) WriteLine(ledger, row);
                receipt.RecordedUsers = records.Count; store.Save(receipt);
                WriteLine(journal, new { state = "flushed", users = chunk, at = Clock.Now() });
                pending = [];
                await CheckFlags(api, receipt);
                Console.WriteLine($"{cli.Case}/{cli.Batch}: flushed {records.Count}/{users.Length} new users.");
            }
            if (plan.Diagnostic)
            {
                receipt.WindowEnd = await Clock.NextMinute(); store.Save(receipt);
                if (cli.Batch == "probe-attribution")
                {
                    WriteLine(journal, new { state = "attempting-outside-window", at = Clock.Now() });
                    foreach (var row in records.Skip(24))
                    {
                        var user = SdkGateway.User(row.UserKey, cli.Session, plan.Phase);
                        for (var k = 0; k < 3; k++) row.Metrics.Add(sdk.Track(user, cases[0].Metrics[0].Key, 1));
                    }
                    sdk.Flush();
                    // Replace our own completed ledger atomically after recording the intentional late events.
                    ledger.Dispose(); WriteRecords(records);
                }
            }
            foreach (var (t, c) in receipt.Targets.Zip(cases)) SameConfig(t, await api.Resolve(c), true);
            sdk.Flush(); await sdk.DisposeAsync(); sdk = null;
            receipt.CompletedAt = Clock.Now(); receipt.Status = "completed"; receipt.LedgerHash = Json.Hash(records); store.Save(receipt);
        }
        catch (Exception e)
        {
            receipt.Status = "uncertain"; receipt.Error = e is Stop ? e.Message : "SDK/IO operation failed (" + e.GetType().Name + "). No automatic replay is allowed.";
            try { Json.Write(store.FileFor(cli.Case, cli.Batch, "pending.json"), pending); store.Save(receipt); }
            catch (IOException) { /* Original durable intent remains; delivery is still uncertain. */ }
            throw new Stop(receipt.Error, 3);
        }
        finally { if (sdk != null) { try { await sdk.DisposeAsync(); } catch { /* receipt remains uncertain */ } } }
        // Writers are closed before reports read the ledger. Reporting failures must not downgrade completed delivery.
        WriteExpected(cases, receipt, oldRecords.Concat(records).ToList(), receipt.WindowEnd ?? receipt.CompletedAt!.Value);
        Summary(receipt, "Delivery completed; ingestion is not yet verified. Run verify, then Analyze and review results in the UI.");
        Console.WriteLine("Saved " + store.DirectoryFor(cli.Case, cli.Batch));
    }
    private StreamWriter Writer(string name) => new(new FileStream(store.FileFor(cli.Case, cli.Batch, name), FileMode.CreateNew, FileAccess.Write, FileShare.Read), new UTF8Encoding(false)) { AutoFlush = true };
    private static void WriteLine(StreamWriter writer, object value)
    { writer.WriteLine(JsonSerializer.Serialize(value, Lines)); writer.Flush(); ((FileStream)writer.BaseStream).Flush(true); }
    private void WriteRecords(List<UserRecord> records)
    {
        var file = store.FileFor(cli.Case, cli.Batch, "users.jsonl"); var temp = file + ".complete.tmp";
        using (var writer = new StreamWriter(temp, false, new UTF8Encoding(false))) foreach (var row in records) writer.WriteLine(JsonSerializer.Serialize(row, Lines));
        File.Move(temp, file, true);
    }
    private double[] Values(Scenario c, MetricSpec m, int metric, int variant, BatchPlan plan, string key, int userIndex) => plan.Id switch
    {
        "probe-zero-events" => [],
        "probe-zero-control" => metric == 0 && variant == 1 ? [1] : [],
        "probe-constant" => metric == 0 ? [50, 50] : metric == 1 ? [4, 4] : [0],
        "probe-attribution" => metric != 0 ? [] : userIndex < 8 ? [1, 9] : userIndex is >= 16 and < 24 ? [0] : [],
        _ => Generator.Values(m, variant, plan.Phase, key, settings.Seed)
    };
    private async Task CheckFlags(ManagementApi api, Receipt receipt)
    {
        foreach (var t in receipt.Targets)
        {
            var key = Catalog.Find(catalog, t.CaseId).FlagKey;
            var live = await api.Get($"/api/v1/envs/{api.EnvId}/feature-flags/{Uri.EscapeDataString(key)}");
            if (Json.Hash(t.Flag) != Json.Hash(live)) throw new Stop("Flag changed during the batch; recorded stage proportions no longer apply.", 3);
        }
    }
    private static async Task<JsonNode> CheckRecommendations(ManagementApi api, Target current, Receipt previous)
    {
        var analysis = Json.ParseField((await api.Run(current))["analysisResult"]) ?? throw new Stop("Analyze the completed A batch in the UI before B.");
        var computed = Json.Date(analysis["computed_at"]);
        if (Json.Text(analysis["type"]) != "bandit" || Json.Text(analysis["metric"]) != Json.Text(current.Run["primaryMetricEvent"]) ||
            computed == null || computed < previous.CompletedAt || computed > Clock.Now().AddSeconds(5) ||
            Json.Date(analysis["window"]?["start"]) != previous.WindowStart ||
            (Json.Date(analysis["window"]?["end"]) is { } end && end < previous.CompletedAt))
            throw new Stop("Phase A analysis is stale or uses a different metric/window. Analyze the completed A batch in the UI.");
        if (!Json.Bool(analysis["thompson_sampling"]?["enough_units"])) throw new Stop("Phase A is still in burn-in; no recommendation may be applied.");
        if (Json.Hash(previous.Targets[0].Flag) == Json.Hash(current.Flag)) throw new Stop("Apply the A recommendation to the flag in the UI before B.");
        var results = Json.Array(analysis["thompson_sampling"]?["results"]);
        if (!results.Select(r => Json.Text(r?["arm"])).Order().SequenceEqual(current.Weights.Keys.Order()))
            throw new Stop("Phase A recommendation must include the baseline and both arms exactly once.");
        var total = results.Sum(r => Json.Number(r?["recommended_weight"]));
        if (!double.IsFinite(total) || Math.Abs(total - 1) > 1e-8) throw new Stop("Phase A recommended weights must total 100%.");
        foreach (var (id, p) in current.Weights)
        {
            var row = results.Single(r => Json.Text(r?["arm"]) == id);
            var wanted = Json.Number(row?["recommended_weight"]);
            // UI percentages can be rounded to whole percent; the allowance is fixed before observing results.
            if (!double.IsFinite(wanted) || wanted is <= 0 or > 1 || Math.Abs(p - wanted) > .0051) throw new Stop("Phase B split differs from the A recommendation by more than 0.51 percentage points.");
        }
        return analysis;
    }
    private sealed record QueryResult(Checks Checks, Dictionary<string, object> Expected, Dictionary<string, object> Observed, Dictionary<string, JsonNode> WithoutLayerObserved);
    private async Task<QueryResult> Query(ManagementApi api, Scenario[] cases, Receipt r, List<UserRecord> records, DateTimeOffset end, DateTimeOffset? startOverride = null)
    {
        var checks = new Checks(); var expected = new Dictionary<string, object>(); var observed = new Dictionary<string, object>(); var start = startOverride ?? r.WindowStart;
        var withoutLayerObserved = new Dictionary<string, JsonNode>();
        foreach (var (t, c) in r.Targets.Zip(cases))
        {
            var aggregate = Ledger.Aggregate(c, t.VariationIds, records, start, end); expected[c.Id] = aggregate;
            var results = new Dictionary<string, JsonNode>(); observed[c.Id] = results;
            foreach (var m in c.Metrics)
            {
                var result = await api.Stats(t, c, m, start, end); results[m.Key] = result;
                CompareStats(c.Id + "/" + m.Key, aggregate[m.Key], result, checks);
            }
            var primary = c.Metrics[0];
            var unfiltered = c.LayerKey == null ? results[primary.Key] : await api.Stats(t, c, primary, start, end, includeLayer: false);
            withoutLayerObserved[c.Id] = unfiltered;
            if (c.LayerKey != null)
                CompareStats(c.Id + "/without-layer/" + primary.Key, Ledger.Aggregate(c, t.VariationIds, records, start, end, applyLayer: false)[primary.Key], unfiltered, checks);
        }
        return new(checks, expected, observed, withoutLayerObserved);
    }
    public static void CompareStats(string prefix, Dictionary<string, Stat> expected, JsonNode result, Checks checks)
    {
        var rows = Json.Array(result["variants"]);
        checks.Add(prefix + "/known unique variants", rows.All(r => expected.ContainsKey(Json.Text(r?["variant"]))) && rows.Select(r => Json.Text(r?["variant"])).Distinct().Count() == rows.Count);
        foreach (var (id, stat) in expected)
        {
            var row = rows.FirstOrDefault(r => Json.Text(r?["variant"]) == id);
            if (row == null && stat.Users == 0) continue; // SQL groups only present assignments.
            foreach (var (field, value) in new[] { ("users", (double)stat.Users), ("conversions", (double)stat.Conversions), ("sumValue", stat.Sum), ("sumSquares", stat.SumSquares), ("avgValue", stat.Mean), ("conversionRate", stat.Users == 0 ? 0 : (double)stat.Conversions / stat.Users) })
                checks.Equal(prefix + "/" + id + "/" + field, Json.Number(row?[field]), value, field is "users" or "conversions" ? 0 : 1e-8);
        }
    }
    private async Task Verify(ManagementApi api, Scenario[] cases)
    {
        var r = store.Read(cli.Case, cli.Batch); AssertReceipt(r);
        foreach (var dep in r.Dependencies) AssertReceipt(store.Read(cli.Case, dep));
        var records = store.Cumulative(r); var prechecks = new Checks();
        foreach (var (t, c) in r.Targets.Zip(cases)) SameConfig(t, await api.Resolve(c), false);
        var end = r.WindowEnd ?? r.CompletedAt!.Value;
        var deadline = DateTimeOffset.UtcNow.AddSeconds(settings.IngestionTimeoutSeconds);
        QueryResult data;
        do
        {
            data = await Query(api, cases, r, records, end);
            if (data.Checks.Passed || DateTimeOffset.UtcNow >= deadline) break;
            Console.WriteLine("Waiting for ingestion; current comparison still differs from the ledger."); await Task.Delay(2000);
        } while (true);
        Json.Write(store.FileFor(cli.Case, cli.Batch, "expected.json"), data.Expected);
        Json.Write(store.FileFor(cli.Case, cli.Batch, "observed.json"), data.Observed);
        Json.Write(store.FileFor(cli.Case, cli.Batch, "observed-without-layer.json"), data.WithoutLayerObserved);
        WritePopulation(cases, r, records, end, data.Observed, data.WithoutLayerObserved);
        prechecks.Items.AddRange(data.Checks.Items);
        if (data.Checks.Passed)
        {
            if (r.Phase == "b")
            {
                var increment = await Query(api, cases, r, store.Records(cli.Case, cli.Batch), r.CompletedAt!.Value, r.StartedAt);
                prechecks.Items.AddRange(increment.Checks.Items.Select(x => x with { Name = "B-increment/" + x.Name }));
                Json.Write(store.FileFor(cli.Case, cli.Batch, "increment.json"), new { increment.Expected, increment.Observed, increment.WithoutLayerObserved });
            }
            WriteSrm(cases, r, records, prechecks);
        }
        Json.Write(store.FileFor(cli.Case, cli.Batch, "checks.json"), prechecks);
        Json.Write(store.FileFor(cli.Case, cli.Batch, "verification-data.json"), new { passed = prechecks.Passed, at = Clock.Now(), receiptHash = Json.Hash(r), ledgerHash = r.LedgerHash });
        Summary(r, $"Data verification: {(prechecks.Passed ? "PASS" : "FAIL")}; {prechecks.Items.Count} assertions. " + string.Join("; ", prechecks.Items.Where(x => !x.Passed).Take(5).Select(x => x.Name)));
        Console.WriteLine($"{cli.Case}/{cli.Batch} data: {(prechecks.Passed ? "PASS" : "FAIL")} ({prechecks.Items.Count} assertions). {store.DirectoryFor(cli.Case, cli.Batch)}");
        prechecks.Require();
    }
    private void WriteSrm(Scenario[] cases, Receipt receipt, List<UserRecord> records, Checks checks)
    {
        var reports = new List<object>();
        foreach (var (t, c) in receipt.Targets.Zip(cases))
        {
            var stageRecords = receipt.Phase == "b" ? records.Where(r => r.Phase == "b").ToList() : records;
            var stats = Ledger.Aggregate(c, t.VariationIds, stageRecords, receipt.WindowStart, receipt.WindowEnd ?? receipt.CompletedAt!.Value)[c.Metrics[0].Key];
            var ids = c.Values.Select(v => t.VariationIds[v]).ToArray(); var counts = ids.Select(id => stats[id].Users).ToArray(); var weights = ids.Select(id => t.Weights[id]).ToArray();
            var formal = !receipt.Diagnostic && receipt.BatchId is "main" or "a-full" or "b";
            var largeEnough = weights.All(p => counts.Sum() * p >= 5);
            var pValue = formal && largeEnough ? Ledger.Srm(counts, weights) : (double?)null;
            reports.Add(new { c.Id, phase = receipt.Phase, counts, weights, expected = weights.Select(p => p * counts.Sum()), formal, pValue, threshold = .01 / 8,
                note = formal ? "One of eight fixed stage tests; family alpha=0.01. A+B has no pooled p-value because B weights depend on A." : "Diagnostic/checkpoint: counts only; no repeated significance test.",
                productLimitation = "SRM-DYNAMIC-001: the product currently assumes equal shares. Its red SRM indicator can be incorrect at unequal traffic weights." });
            if (formal)
            {
                checks.Add(c.Id + "/SRM adequate expected counts", largeEnough, "The fixed main batches require expected cell counts >=5. Smaller custom batches need an exact test.");
                checks.Add(c.Id + "/stage SRM", pValue >= .01 / 8, $"p={pValue:G8}; predeclared threshold=0.00125. Investigate; never redraw users to force a pass.");
            }
        }
        Json.Write(store.FileFor(cli.Case, cli.Batch, "traffic.json"), reports);
    }
    private void WriteExpected(Scenario[] cases, Receipt receipt, List<UserRecord> records, DateTimeOffset end)
    {
        Json.Write(store.FileFor(cli.Case, cli.Batch, "expected.json"), receipt.Targets.Zip(cases).ToDictionary(pair => pair.Second.Id, pair => Ledger.Aggregate(pair.Second, pair.First.VariationIds, records, receipt.WindowStart, end)));
        WritePopulation(cases, receipt, records, end);
    }
    private void WritePopulation(Scenario[] cases, Receipt receipt, List<UserRecord> records, DateTimeOffset end, Dictionary<string, object>? observed = null, Dictionary<string, JsonNode>? withoutLayerObserved = null)
    {
        var batchRecords = store.Records(receipt.CaseId, receipt.BatchId);
        var population = cases.Select(c => new
        {
            c.Id, c.LayerKey, c.SliceStart, c.SliceEnd,
            batch = Ledger.Population(c, batchRecords, receipt.WindowStart, end),
            cumulative = Ledger.Population(c, records, receipt.WindowStart, end),
            observedCumulativeLayerUsers = observed == null ? (double?)null : Json.Array(((Dictionary<string, JsonNode>)observed[c.Id])[c.Metrics[0].Key]["variants"]).Sum(row => Json.Number(row?["users"])),
            observedCumulativeUsersWithoutLayer = withoutLayerObserved == null ? (double?)null : Json.Array(withoutLayerObserved[c.Id]["variants"]).Sum(row => Json.Number(row?["users"]))
        });
        Json.Write(store.FileFor(cli.Case, cli.Batch, "population.json"), new
        {
            receipt.UserPoolPolicy, receipt.RequestedUsers, receipt.RecordedUsers, population,
            note = "All planned users are evaluated and tracked. Expected counts come from the ledger. Observed cumulative counts query the same flag and window with and without Layer, without modifying Run assignments. No layer preselection or replacement users."
        });
    }
    private void Summary(Receipt r, string message)
    {
        var collectionEnd = r.WindowEnd ?? r.CompletedAt;
        var suggestedEnd = collectionEnd == null ? (DateTimeOffset?)null : Clock.FloorMinute(collectionEnd.Value).AddMinutes(collectionEnd.Value.Second == 0 && collectionEnd.Value.Millisecond == 0 ? 0 : 1);
        var warnings = r.Targets.Where(t => !Catalog.Find(catalog, t.CaseId).Bandit && t.Run["minimumSample"]?.GetValue<int>() != 500)
            .Select(t => $"{t.CaseId}: minimumSample is not 500; insufficient-sample UI coverage remains unconfigured.");
        var text = $"# {r.CaseId} / {r.BatchId}\n\n{message}\n\nSession: {r.SessionId}; status: {r.Status}; new users sent (before Layer): {r.RecordedUsers}/{r.RequestedUsers}.\n\n" +
            $"User pool policy: {r.UserPoolPolicy}. See [population.json](population.json) for sent, Layer-included and excluded users; [observed.json](observed.json) is available after verify.\n\n" +
            $"UTC observation start: {r.WindowStart:O}\n\nUTC suggested UI end: {suggestedEnd:O} (keep open while more main batches are pending).\n\n" +
            $"Local display ({TimeZoneInfo.Local.Id}): {r.WindowStart.ToLocalTime():yyyy-MM-dd HH:mm} → {suggestedEnd?.ToLocalTime():yyyy-MM-dd HH:mm}.\n\n" +
            $"Collected: {r.StartedAt:O} → {r.CompletedAt:O}; dependency batches: {string.Join(", ", r.Dependencies)}.\n\n" +
            string.Join("\n\n", warnings) + "\n\nSDK flush is transport evidence. Run verify for ingestion checks; Analyze and review experiment results in the UI.\n";
        File.WriteAllText(store.FileFor(cli.Case, cli.Batch, "summary.md"), text, new UTF8Encoding(false));
    }
}
