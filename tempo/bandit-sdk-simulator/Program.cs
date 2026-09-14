using System.Globalization;
using System.Text.Json;
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true };
try
{
    if (args.Contains("--help"))
    {
        Console.WriteLine("""
            FeatBit Bandit SDK simulator (.NET 10)
            --config <path>       Default: simulation.json next to the executable
            --users <count>       Override total users (1..100000)
            --seed <integer>      Override random seed for synthetic outcomes
            --batch-id <id>       Default: new UTC timestamp + GUID; never reuse for fresh users
            --output-dir <path>   Default: ./results
            --dry-run             Validate config and print plan; no network or SDK events
            --help                Show this help

            SDK key: FEATBIT_SIM_SDK_KEY environment variable (never logged or saved).
            The SDK determines each user's arm using the live flag. Outcomes are synthetic.
            This program never edits flags, experiments, or analysis results.
            """);
        return 0;
    }

    var cli = ParseArgs(args);
    var configPath = Path.GetFullPath(cli.GetValueOrDefault("--config") ??
        Path.Combine(AppContext.BaseDirectory, "simulation.json"));
    var config = JsonSerializer.Deserialize<SimulationConfig>(await File.ReadAllTextAsync(configPath), jsonOptions)
        ?? throw new InvalidOperationException("Empty simulation configuration.");
    if (cli.TryGetValue("--users", out var userCount)) config.Users = int.Parse(userCount, CultureInfo.InvariantCulture);
    if (cli.TryGetValue("--seed", out var seed)) config.Seed = int.Parse(seed, CultureInfo.InvariantCulture);
    Validate(config);
    var batchId = cli.GetValueOrDefault("--batch-id") ?? $"{DateTimeOffset.UtcNow:yyyyMMddTHHmmssfffZ}-{Guid.NewGuid():N}";
    if (batchId.Length > 100 || batchId.Any(c => !char.IsAsciiLetterOrDigit(c) && c is not '-' and not '_'))
        throw new ArgumentException("batch-id must use 1..100 ASCII letters, numbers, '-' or '_'.");
    if (batchId.Length == 0) throw new ArgumentException("batch-id cannot be empty.");

    Console.WriteLine($"Flag: {config.FlagKey}; users: {config.Users}; batch: {batchId}");
    Console.WriteLine($"Marker: {config.SimulatorAttribute}={config.SimulatorValue}; outcome seed: {config.Seed}");
    foreach (var arm in config.Arms)
        Console.WriteLine($"  {arm.Name} ({arm.Value}): conversion={arm.ConversionProbability:P0}; count/user mean={arm.GuardrailEventsPerUser:F1}");
    if (cli.ContainsKey("--dry-run"))
    {
        Console.WriteLine("Dry run complete. No SDK connection or data written.");
        return 0;
    }

    var sdkKey = Environment.GetEnvironmentVariable("FEATBIT_SIM_SDK_KEY");
    if (string.IsNullOrWhiteSpace(sdkKey))
        throw new InvalidOperationException("Set FEATBIT_SIM_SDK_KEY to the environment's Server SDK key, or use run-local.ps1.");
    var outputDir = Path.GetFullPath(cli.GetValueOrDefault("--output-dir") ?? "results");
    Directory.CreateDirectory(outputDir);
    var reportPath = Path.Combine(outputDir, $"{batchId}.json");
    var usersPath = Path.Combine(outputDir, $"{batchId}.users.jsonl");
    if (File.Exists(reportPath) || File.Exists(usersPath))
        throw new InvalidOperationException("This batch-id already has output. Use a new batch-id to avoid duplicate users/events.");

    using var cancellation = new CancellationTokenSource();
    Console.CancelKeyPress += (_, e) => { e.Cancel = true; cancellation.Cancel(); };
    var token = cancellation.Token;
    var startedAt = DateTimeOffset.UtcNow;
    var byValue = config.Arms.ToDictionary(a => a.Value, StringComparer.Ordinal);
    var totals = config.Arms.ToDictionary(a => a.Value, a => new ArmTotals(a.Name, a.Value, a.VariationId), StringComparer.Ordinal);
    var random = new Random(config.Seed);
    var client = new FbClient(new FbOptionsBuilder(sdkKey)
        .Streaming(new Uri(config.StreamingUrl))
        .Event(new Uri(config.EventUrl))
        .StartWaitTime(TimeSpan.FromSeconds(15))
        .AutoFlushInterval(TimeSpan.FromSeconds(1))
        .MaxEventsInQueue(20000)
        .MaxEventPerRequest(500)
        .Build());
    var status = "failed";
    string? error = null;
    var completedUsers = 0;
    try
    {
        if (!client.Initialized)
            throw new InvalidOperationException("SDK initialization failed. Check the Server SDK key and Evaluation Server endpoints.");
        await using var userLog = new StreamWriter(new FileStream(usersPath, FileMode.CreateNew, FileAccess.Write, FileShare.Read));
        for (var offset = 0; offset < config.Users; offset += config.BatchSize)
        {
            token.ThrowIfCancellationRequested();
            var users = new List<(FbUser User, ArmConfig Arm)>();
            for (var i = offset; i < Math.Min(offset + config.BatchSize, config.Users); i++)
            {
                var user = FbUser.Builder($"{config.UserPrefix}-{batchId}-{i + 1:D6}")
                    .Name($"Synthetic bandit user {i + 1}")
                    .Custom(config.SimulatorAttribute, config.SimulatorValue)
                    .Custom("simulation_batch", batchId)
                    .Build();
                // Exactly one live evaluation per new user; never assign arms in the simulator.
                var detail = client.StringVariationDetail(config.FlagKey, user, "__sdk_fallback__");
                if (!byValue.TryGetValue(detail.Value, out var arm) || detail.ValueId != arm.VariationId)
                    throw new InvalidOperationException($"Unexpected SDK evaluation: value={detail.Value}, id={detail.ValueId}, reason={detail.Reason}.");
                totals[arm.Value].Evaluations++;
                users.Add((user, arm));
            }
            Flush(client, "exposures");
            // Outcomes must follow exposure. Do not backdate SDK events or use Track(..., 0) for binary failures.
            await Task.Delay(config.OutcomeDelayMs, token);
            foreach (var (user, arm) in users)
            {
                var converted = random.NextDouble() < arm.ConversionProbability;
                if (converted) client.Track(user, config.PrimaryMetric, 1d);
                var guardrailCount = Poisson(random, arm.GuardrailEventsPerUser);
                // The configured guardrail uses count aggregation: emit N events, not one event with numericValue=N.
                for (var i = 0; i < guardrailCount; i++) client.Track(user, config.GuardrailMetric, 1d);
                var total = totals[arm.Value];
                total.OutcomeUsers++;
                total.Conversions += converted ? 1 : 0;
                total.GuardrailEvents += guardrailCount;
                await userLog.WriteLineAsync(JsonSerializer.Serialize(new
                {
                    userKey = user.Key, arm = arm.Name, value = arm.Value, variationId = arm.VariationId,
                    converted, guardrailCount
                }));
                completedUsers++;
            }
            Flush(client, "outcomes");
            await userLog.FlushAsync(token);
            Console.WriteLine($"Flushed {completedUsers}/{config.Users} users.");
            if (completedUsers < config.Users) await Task.Delay(config.BatchDelayMs, token);
        }
        status = "completed";
    }
    catch (OperationCanceledException)
    {
        status = "cancelled";
        error = "Cancelled; previously flushed events remain in FeatBit. Use a new batch-id to add fresh users.";
    }
    catch (Exception ex)
    {
        error = ex.Message;
    }
    finally
    {
        try { await client.CloseAsync(); }
        catch (Exception ex) { status = "failed"; error = $"SDK shutdown failed: {ex.Message}"; }
        var report = new
        {
            status, error, batchId, synthetic = true, startedAtUtc = startedAt,
            completedAtUtc = DateTimeOffset.UtcNow, config.FlagKey, config.PrimaryMetric, config.GuardrailMetric,
            requestedUsers = config.Users, completedUsers, config.Seed, arms = totals.Values,
            note = "SDK-side totals. Confirm ingestion/attribution with run-local.ps1; flushing alone is not analysis verification."
        };
        var json = JsonSerializer.Serialize(report, jsonOptions);
        await File.WriteAllTextAsync(reportPath, json);
        await File.WriteAllTextAsync(Path.Combine(outputDir, "latest.json"), json);
    }
    foreach (var arm in totals.Values)
        Console.WriteLine($"{arm.Name,-23} n={arm.Evaluations,5}, conversions={arm.Conversions,4}, rate={arm.Rate:P2}, guardrail count/user={arm.GuardrailMean:F3}");
    Console.WriteLine($"Report: {reportPath}");
    if (error != null) { Console.Error.WriteLine(error); return 1; }
    if (totals.Values.Any(a => a.Evaluations < 100))
        Console.WriteLine("Some arms have fewer than 100 users. Inspect live targeting and the analysis window before interpreting Bandit results.");
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex.Message);
    return 1;
}

static Dictionary<string, string> ParseArgs(string[] args)
{
    var result = new Dictionary<string, string>(StringComparer.Ordinal);
    var valued = new HashSet<string> { "--config", "--users", "--seed", "--batch-id", "--output-dir" };
    for (var i = 0; i < args.Length; i++)
    {
        var key = args[i];
        if (key == "--dry-run") { result.Add(key, "true"); continue; }
        if (!valued.Contains(key) || i + 1 == args.Length || args[i + 1].StartsWith("--"))
            throw new ArgumentException($"Unknown/incomplete option: {key}. Use --help.");
        result.Add(key, args[++i]);
    }
    return result;
}

static void Validate(SimulationConfig config)
{
    if (string.IsNullOrWhiteSpace(config.FlagKey) || string.IsNullOrWhiteSpace(config.PrimaryMetric) ||
        string.IsNullOrWhiteSpace(config.GuardrailMetric) || config.PrimaryMetric == config.GuardrailMetric)
        throw new ArgumentException("Set a flag key and two distinct metric event names.");
    if (config.Users is < 1 or > 100000 || config.BatchSize is < 1 or > 500 ||
        config.OutcomeDelayMs is < 1 or > 60000 || config.BatchDelayMs is < 0 or > 60000)
        throw new ArgumentException("Invalid users (1..100000), batchSize (1..500), or delay (up to 60000ms).");
    if (string.IsNullOrWhiteSpace(config.UserPrefix) || string.IsNullOrWhiteSpace(config.SimulatorAttribute) ||
        string.IsNullOrWhiteSpace(config.SimulatorValue)) throw new ArgumentException("A synthetic user prefix and attribute are required.");
    if (!Uri.TryCreate(config.StreamingUrl, UriKind.Absolute, out var stream) || stream.Scheme is not ("ws" or "wss") ||
        !Uri.TryCreate(config.EventUrl, UriKind.Absolute, out var events) || events.Scheme is not ("http" or "https"))
        throw new ArgumentException("Use ws(s) for streamingUrl and http(s) for eventUrl.");
    if (config.Arms.Length < 2 || config.Arms.Any(a => string.IsNullOrWhiteSpace(a.Name) || string.IsNullOrWhiteSpace(a.Value) ||
        !Guid.TryParse(a.VariationId, out _) || !double.IsFinite(a.ConversionProbability) ||
        a.ConversionProbability is < 0 or > 1 || !double.IsFinite(a.GuardrailEventsPerUser) || a.GuardrailEventsPerUser is < 0 or > 20) ||
        config.Arms.Select(a => a.Value).Distinct().Count() != config.Arms.Length ||
        config.Arms.Select(a => a.VariationId).Distinct().Count() != config.Arms.Length)
        throw new ArgumentException("Provide at least two unique arms with variation IDs, conversion probabilities 0..1, and count means 0..20.");
}

static int Poisson(Random random, double mean)
{
    var limit = Math.Exp(-mean);
    var product = 1d;
    var count = 0;
    do { count++; product *= random.NextDouble(); } while (product > limit);
    return count - 1;
}

static void Flush(FbClient client, string phase)
{
    if (!client.FlushAndWait(TimeSpan.FromSeconds(30)))
        throw new IOException($"SDK flush timed out during {phase}. Already sent events are not rolled back.");
}

sealed class SimulationConfig
{
    public string FlagKey { get; set; } = "";
    public string StreamingUrl { get; set; } = "";
    public string EventUrl { get; set; } = "";
    public string PrimaryMetric { get; set; } = "";
    public string GuardrailMetric { get; set; } = "";
    public int Users { get; set; } = 4000;
    public int BatchSize { get; set; } = 200;
    public int OutcomeDelayMs { get; set; } = 100;
    public int BatchDelayMs { get; set; } = 250;
    public int Seed { get; set; } = 20260907;
    public string UserPrefix { get; set; } = "bandit-sim";
    public string SimulatorAttribute { get; set; } = "expt_simulator";
    public string SimulatorValue { get; set; } = "bandit-sdk-v1";
    public ArmConfig[] Arms { get; set; } = [];
}

sealed class ArmConfig
{
    public string Name { get; set; } = "";
    public string Value { get; set; } = "";
    public string VariationId { get; set; } = "";
    public double ConversionProbability { get; set; }
    public double GuardrailEventsPerUser { get; set; }
}

sealed class ArmTotals(string name, string value, string variationId)
{
    public string Name { get; } = name;
    public string Value { get; } = value;
    public string VariationId { get; } = variationId;
    public int Evaluations { get; set; }
    public int OutcomeUsers { get; set; }
    public int Conversions { get; set; }
    public int GuardrailEvents { get; set; }
    public double Rate => OutcomeUsers == 0 ? 0 : Conversions / (double)OutcomeUsers;
    public double GuardrailMean => OutcomeUsers == 0 ? 0 : GuardrailEvents / (double)OutcomeUsers;
}
