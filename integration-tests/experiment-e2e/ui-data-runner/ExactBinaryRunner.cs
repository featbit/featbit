using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Evaluation;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

namespace UiExperimentData;

public sealed record ExactEnvironment(string ApiUrl, string EventUrl, string StreamingUrl,
    string ProjectKey, string ProjectName, string EnvironmentName, string EnvId, string OrganizationName,
    string OrganizationId, string WorkspaceId)
{
    public static ExactEnvironment From(Settings s) => new(s.ApiUrl, s.EventUrl, s.StreamingUrl,
        s.ProjectKey, s.ProjectName, s.EnvironmentName, s.EnvId, s.OrganizationName, s.OrganizationId, s.WorkspaceId);
}

public sealed record ExactPreview(string Version, string SessionId, DateTimeOffset CreatedAt,
    ExactEnvironment Environment, string[] Users);

public sealed class ExactReceipt
{
    public string Status { get; set; } = "started";
    public string PlanHash { get; set; } = "";
    public string LedgerHash { get; set; } = "";
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? EndAt { get; set; }
    public int EvaluationCalls { get; set; }
    public int TrackCalls { get; set; }
    public Target Target { get; set; } = new();
    public string? Error { get; set; }
}

// A separate entry point in the existing SDK project. It never invokes the probabilistic Generator.
public sealed class ExactBinaryRunner(Cli cli, Settings settings)
{
    private readonly string directory = Path.Combine(settings.ReportRoot, cli.Session, "exact-binary");
    private static readonly JsonSerializerOptions Lines = new(Json.Options) { WriteIndented = false };
    private static Scenario Scenario => ExactBinaryPlan.Scenario;
    private string FileFor(string name) => Path.Combine(directory, name);

    public async Task Execute()
    {
        using var sessionLock = new BatchStore(settings.ReportRoot, cli.Session).Lock();
        Directory.CreateDirectory(directory);
        if (cli.Action == "exact-preview") { Preview(); return; }
        var plan = ReadPlan();
        // Check before connecting or constructing an SDK: a started batch can never be replayed.
        if (cli.Action == "exact-inject" && File.Exists(FileFor("receipt.json")))
            throw new Stop("This session already has an injection intent. Use verify; never replay it.");
        using var api = new ManagementApi(settings);
        await api.Connect();
        if (cli.Action == "exact-inject") await Inject(api, plan);
        else await Verify(api, plan, Json.Read<ExactReceipt>(FileFor("receipt.json")));
    }

    private ExactPreview ReadPlan()
    {
        var plan = Json.Read<ExactPreview>(FileFor("plan.json"));
        if (plan.Version != ExactBinaryPlan.Version || plan.SessionId != cli.Session ||
            plan.Environment != ExactEnvironment.From(settings))
            throw new Stop("The saved preview has a different version, session or target configuration.");
        ExactBinaryPlan.ValidateUsers(plan.Users);
        return plan;
    }

    private void Preview()
    {
        if (File.Exists(FileFor("receipt.json"))) throw new Stop("This session has already started injection. Preview cannot replace its evidence.");
        if (!File.Exists(FileFor("plan.json")))
            Json.Write(FileFor("plan.json"), new ExactPreview(ExactBinaryPlan.Version, cli.Session, Clock.Now(),
                ExactEnvironment.From(settings), ExactBinaryPlan.NewUsers()));
        var plan = ReadPlan();
        File.WriteAllText(FileFor("preview.md"), $"""
            # 精确 Binary 数据预览

            状态：仅生成本地计划，未连接 API 或 SDK，未执行 evaluation 或 Track。

            版本：{plan.Version}；Session：{plan.SessionId}。
            项目：{plan.Environment.ProjectName}；环境：{plan.Environment.EnvironmentName}。
            Flag：{ExactBinaryPlan.FlagKey}。

            已固定 2,000 个不同 UUID，完整名单保存在 plan.json。
            正式执行将对每个 UUID 调用且仅调用一次 BoolVariationDetail，再根据实际返回值选人。
            不使用 targeting rules、Layer 预筛选、额外探测 evaluation 或补选用户。
            Default split 必须为 50% / 50%；实际 true / false 人数尚未知，不强制各 1,000 人。

            | Metric | true 用户数 | true Track 次数 | true value 总和 | false 用户数 | false Track 次数 | false value 总和 |
            | --- | ---: | ---: | ---: | ---: | ---: | ---: |
            | {ExactBinaryPlan.BinaryKey} | 153 | 153 | 153 | 88 | 88 | 88 |
            | {ExactBinaryPlan.CountKey} | 100 | 120 | 120 | 100 | 210 | 210 |
            | {ExactBinaryPlan.SumKey} | 50 | 50 | 1201 | 50 | 50 | 2210 |

            总计 2,000 次 flag evaluation、671 次 Track。Binary/Count 的每次 value 为 1。
            Count：true 为 80 人各 1 次、20 人各 2 次；false 为 90 人各 2 次、10 人各 3 次。
            Sum：true 为 49 人各 24、1 人 25；false 为 40 人各 44、10 人各 45，每人 Track 一次。

            每个 metric 在实际 true/false 组内按 evaluation 顺序取前 N 人。不同 metric 的用户允许重叠。
            若 true 少于 153 人或 false 少于 100 人，保留已发生的曝光并停止，尚不调用任何 Track，也不增加 evaluation。
            正式执行先确认全部曝光入库，再发送 metrics；保存逐调用记录、逐用户账本和最终对账。

            Samples (n) 应分别为实际 N_true / N_false，合计 2,000，包含没有 track 的用户。
            Binary rate 为 153/N_true、88/N_false；Count 均值为 120/N_true、210/N_false；
            Sum 均值为 1201/N_true、2210/N_false。各分母不是选中 track 的人数。

            """ + Environment.NewLine, new UTF8Encoding(false));
        Console.WriteLine($"PREVIEW ONLY: 2000 UUID users; 671 planned Track calls; no API/SDK calls. {FileFor("preview.md")}");
    }

    private static void SameTarget(Target saved, Target current)
    {
        if (saved.EnvId != current.EnvId || saved.ConfigHash != current.ConfigHash ||
            Json.Hash(saved.Flag) != Json.Hash(current.Flag))
            throw new Stop("Flag or experiment assignment changed. Do not mix configurations or replay the batch.", 3);
    }

    private async Task Inject(ManagementApi api, ExactPreview plan)
    {
        var target = await api.Resolve(Scenario);
        if (target.Weights.Values.Any(w => Math.Abs(w - .5) > 1e-9))
            throw new Stop("This case requires the existing flag's default split to be 50% / 50%.");
        var receipt = new ExactReceipt { Target = target, PlanHash = Json.Hash(plan), StartedAt = Clock.Now().AddMilliseconds(-1) };
        // Durable intent exists before even initializing the live SDK. No resume/retry injection path.
        Json.Write(FileFor("receipt.json"), receipt);
        var records = new List<UserRecord>();
        var exposures = new List<ExactExposure>();
        ExactBinarySdk? sdk = null;
        try
        {
            using var journal = new StreamWriter(new FileStream(FileFor("calls.jsonl"), FileMode.CreateNew,
                FileAccess.Write, FileShare.Read), new UTF8Encoding(false)) { AutoFlush = true };
            void WriteCall(object entry)
            {
                journal.WriteLine(JsonSerializer.Serialize(entry, Lines));
                journal.Flush(); ((FileStream)journal.BaseStream).Flush(true);
            }
            sdk = new ExactBinarySdk(settings, api.SdkKey, target);
            sdk.Ready();
            foreach (var key in plan.Users)
            {
                WriteCall(new { state = "intent", method = "BoolVariationDetail", userKey = key, at = Clock.Now() });
                receipt.EvaluationCalls++;
                var exposure = sdk.Evaluate(key);
                exposures.Add(exposure);
                records.Add(new UserRecord
                {
                    UserKey = key, Phase = "exact",
                    Exposures = [new(Scenario.Id, exposure.VariationId, exposure.Value ? "true" : "false", exposure.At, true)]
                });
                WriteCall(new { state = "returned", method = "BoolVariationDetail", exposure });
                if (records.Count % settings.ChunkSize == 0)
                {
                    sdk.Flush();
                    Console.WriteLine($"Evaluated {records.Count}/2000 distinct UUID users.");
                }
            }
            sdk.Flush();
            Json.Write(FileFor("exposures.json"), exposures);
            var tracks = ExactBinaryPlan.Select(exposures);
            Json.Write(FileFor("track-plan.json"), tracks);
            SameTarget(target, await api.Resolve(Scenario));
            // Stop on missing exposure ingestion (including the previously observed first-batch loss).
            // This reads server data; it does not evaluate another flag/user or alter the Run.
            await WaitForIngestion(api, target, records, receipt.StartedAt, Clock.Now().AddMilliseconds(1), "exposure-check");
            var byUser = records.ToDictionary(r => r.UserKey);
            foreach (var track in tracks)
            {
                WriteCall(new { state = "intent", method = "Track", track, at = Clock.Now() });
                receipt.TrackCalls++;
                var at = sdk.Track(track);
                byUser[track.UserKey].Metrics.Add(new(track.MetricKey, track.Value, at));
                WriteCall(new { state = "returned", method = "Track", track, at });
            }
            sdk.Flush();
            await sdk.DisposeAsync(); sdk = null;
            SameTarget(target, await api.Resolve(Scenario));
            receipt.EndAt = Clock.Now().AddMilliseconds(1);
            if (receipt.EvaluationCalls != 2000 || receipt.TrackCalls != 671)
                throw new Stop("SDK call totals do not match the exact plan.", 3);
            Json.Write(FileFor("users.json"), records);
            receipt.LedgerHash = Json.Hash(records);
            receipt.Status = "sent-unverified";
            Json.Write(FileFor("receipt.json"), receipt);
        }
        catch (Exception e)
        {
            receipt.Status = "uncertain";
            receipt.Error = e is Stop ? e.Message : $"SDK/IO failure ({e.GetType().Name}); do not replay.";
            Json.Write(FileFor("partial-users.json"), records);
            Json.Write(FileFor("receipt.json"), receipt);
            throw new Stop(receipt.Error, 3);
        }
        finally
        {
            if (sdk != null) { try { await sdk.DisposeAsync(); } catch { /* Durable intent remains uncertain. */ } }
        }
        await Verify(api, plan, receipt);
    }

    private async Task Verify(ManagementApi api, ExactPreview plan, ExactReceipt receipt)
    {
        if (receipt.Status is not ("sent-unverified" or "verified") || receipt.EndAt == null)
            throw new Stop("Batch did not finish delivery. Inspect calls.jsonl and partial-users.json; do not replay.", 3);
        if (receipt.PlanHash != Json.Hash(plan) || receipt.Target.EnvId != api.EnvId ||
            receipt.EvaluationCalls != 2000 || receipt.TrackCalls != 671)
            throw new Stop("Receipt does not match the saved plan or current environment.");
        var records = Json.Read<List<UserRecord>>(FileFor("users.json"));
        if (Json.Hash(records) != receipt.LedgerHash) throw new Stop("The saved user ledger was changed.");
        SameTarget(receipt.Target, await api.Resolve(Scenario));
        await WaitForIngestion(api, receipt.Target, records, receipt.StartedAt, receipt.EndAt.Value, "verification");
        receipt.Status = "verified"; receipt.Error = null;
        Json.Write(FileFor("receipt.json"), receipt);
        var trueN = records.Count(r => r.Exposures.Single().Value == "true");
        File.WriteAllText(FileFor("result.md"), $"""
            # 精确 Binary 入库对账

            PASS：{receipt.EvaluationCalls} 次 evaluation；{receipt.TrackCalls} 次 Track。
            实际 true samples：{trueN}；false samples：{2000 - trueN}；合计 2,000。

            | Metric | true 人数 / 次数 / value 总和 | false 人数 / 次数 / value 总和 |
            | --- | --- | --- |
            | {ExactBinaryPlan.BinaryKey} | 153 / 153 / 153 | 88 / 88 / 88 |
            | {ExactBinaryPlan.CountKey} | 100 / 120 / 120 | 100 / 210 / 210 |
            | {ExactBinaryPlan.SumKey} | 50 / 50 / 1201 | 50 / 50 / 2210 |

            查询窗口 UTC：{receipt.StartedAt:O} → {receipt.EndAt:O}。
            SDK 调用次数来自 calls.jsonl；API 对账检查 users、conversions、sumValue、sumSquares、avgValue、conversionRate。
            对账是当前 flag / 时间窗口的聚合校验，并非数据库原始事件逐行匹配。
            users.json 保存完整逐用户账本；verification.json 保存预期、实际与断言。
            未自动 Analyze 或修改实验窗口，UI 结果需要在包含本批数据的窗口中重新分析。

            """ + Environment.NewLine, new UTF8Encoding(false));
        Console.WriteLine($"VERIFIED: true={trueN}, false={2000 - trueN}; 2000 evaluations, 671 Track calls. {FileFor("result.md")}");
    }

    private async Task WaitForIngestion(ManagementApi api, Target target, List<UserRecord> records,
        DateTimeOffset start, DateTimeOffset end, string output)
    {
        var expected = Ledger.Aggregate(Scenario, target.VariationIds, records, start, end);
        var deadline = Clock.Now().AddSeconds(settings.IngestionTimeoutSeconds);
        while (true)
        {
            var checks = new Checks();
            var observed = new Dictionary<string, JsonNode>();
            foreach (var metric in Scenario.Metrics)
            {
                var result = await api.Stats(target, Scenario, metric, start, end);
                observed[metric.Key] = result;
                Runner.CompareStats(metric.Key, expected[metric.Key], result, checks);
            }
            Json.Write(FileFor(output + ".json"), new { at = Clock.Now(), start, end, expected, observed, checks });
            if (checks.Passed) return;
            if (Clock.Now() >= deadline)
                throw new Stop($"Ingestion differs from the ledger. See {output}.json; do not resend any events.", 1);
            Console.WriteLine("Waiting for database ingestion to match the saved user ledger...");
            await Task.Delay(2000);
        }
    }
}

// Exactly one live evaluation per UUID. No mirror evaluation, configuration probes or user replacement.
internal sealed class ExactBinarySdk : IAsyncDisposable
{
    private readonly FbClient client;
    private readonly Target target;
    private readonly SdkDiagnostics diagnostics = new();
    public ExactBinarySdk(Settings settings, string sdkKey, Target target)
    {
        this.target = target;
        client = new FbClient(new FbOptionsBuilder(sdkKey).Streaming(new Uri(settings.StreamingUrl))
            .Event(new Uri(settings.EventUrl)).StartWaitTime(TimeSpan.FromSeconds(15))
            .AutoFlushInterval(TimeSpan.FromSeconds(1)).MaxEventsInQueue(20000)
            .MaxEventPerRequest(500).MaxSendEventAttempts(1).LoggerFactory(diagnostics).Build());
    }
    private static FbUser User(string key) => FbUser.Builder(key).Build();
    public void Ready()
    {
        if (!client.Initialized || client.Status != FbClientStatus.Ready)
            throw new Stop("SDK is not ready; no fallback or replacement evaluation is allowed.", 3);
        if (diagnostics.Failures > 0) throw new Stop("SDK reported a warning/error. Delivery is uncertain; do not replay.", 3);
    }
    public ExactExposure Evaluate(string key)
    {
        Ready();
        var at = Clock.Now();
        var result = client.BoolVariationDetail(ExactBinaryPlan.FlagKey, User(key), false);
        var value = result.Value ? "true" : "false";
        if (result.Kind != ReasonKind.Fallthrough || string.IsNullOrEmpty(result.ValueId) || target.VariationIds[value] != result.ValueId)
            throw new Stop("SDK did not return the expected default split variation. Do not replay.", 3);
        return new(key, result.ValueId, result.Value, at, result.Kind.ToString(), result.Reason);
    }
    public DateTimeOffset Track(ExactTrack track)
    {
        Ready();
        var at = Clock.Now();
        client.Track(User(track.UserKey), track.MetricKey, track.Value);
        return at;
    }
    public void Flush()
    {
        if (!client.FlushAndWait(TimeSpan.FromSeconds(30))) throw new Stop("SDK flush timed out; do not replay.", 3);
        Ready(); // FlushAndWait=true alone does not prove successful delivery.
    }
    public async ValueTask DisposeAsync()
    {
        try
        {
            await client.CloseAsync();
            if (diagnostics.Failures > 0) throw new Stop("SDK reported a send failure while closing; do not replay.", 3);
        }
        finally { diagnostics.Dispose(); }
    }
}
