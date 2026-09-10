using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace UiExperimentData;

public sealed class ManagementApi : IDisposable
{
    private readonly HttpClient http;
    private readonly Settings settings;
    public string ProjectId { get; private set; } = "";
    public string EnvId { get; private set; } = "";
    public string SdkKey { get; private set; } = "";
    public ManagementApi(Settings settings)
    {
        this.settings = settings;
        http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false });
        http.BaseAddress = new Uri(settings.ApiUrl); http.Timeout = TimeSpan.FromSeconds(30);
    }
    public async Task Connect()
    {
        var token = Environment.GetEnvironmentVariable("FEATBIT_UI_ACCESS_TOKEN");
        var mode = settings.AuthMode;
        if (string.IsNullOrWhiteSpace(token))
        {
            var email = Environment.GetEnvironmentVariable("FEATBIT_UI_LOGIN_EMAIL");
            var password = Environment.GetEnvironmentVariable("FEATBIT_UI_LOGIN_PASSWORD");
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password)) throw new Stop("Set FEATBIT_UI_ACCESS_TOKEN or FEATBIT_UI_LOGIN_EMAIL / FEATBIT_UI_LOGIN_PASSWORD in the process environment.");
            using var response = await http.PostAsJsonAsync("/api/v1/identity/login-by-email", new { email, password });
            token = Json.Text((await Decode(response))["token"]);
            if (token.Length == 0) throw new Stop("Login did not return a token.");
            mode = "bearer";
        }
        if (mode == "bearer") http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        else http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", token);
        var workspace = settings.WorkspaceId;
        if (mode == "bearer" && workspace.Length == 0)
        {
            var workspaces = Items(await Get("/api/v1/user/workspaces"));
            if (workspaces.Count != 1) throw new Stop("Set workspaceId explicitly when the account has more than one workspace.");
            workspace = Json.Text(workspaces[0]?["id"]);
        }
        if (workspace.Length > 0) http.DefaultRequestHeaders.TryAddWithoutValidation("Workspace", workspace);
        var org = settings.OrganizationId;
        if (mode == "bearer" && org.Length == 0)
        {
            var matches = Items(await Get("/api/v1/organizations?isSsoFirstLogin=false")).Where(x => Json.Text(x?["name"]) == settings.OrganizationName).ToArray();
            if (matches.Length != 1) throw new Stop("Organization name is missing or ambiguous. Configure organizationId.");
            org = Json.Text(matches[0]?["id"]);
        }
        if (org.Length > 0) http.DefaultRequestHeaders.TryAddWithoutValidation("Organization", org);
        var projects = Items(await Get("/api/v1/projects")).Where(p => Json.Text(p?["key"]) == settings.ProjectKey && Json.Text(p?["name"]) == settings.ProjectName).ToArray();
        if (projects.Length != 1) throw new Stop("Expected project key/name not found uniquely; no objects were modified.");
        ProjectId = Json.Text(projects[0]?["id"]);
        var project = await Get($"/api/v1/projects/{ProjectId}");
        var envs = Json.Array(project["environments"]).Where(e => Json.Text(e?["name"]) == settings.EnvironmentName && (settings.EnvId.Length == 0 || Json.Text(e?["id"]) == settings.EnvId)).ToArray();
        if (envs.Length != 1) throw new Stop("Expected environment was not found uniquely under the expected project.");
        EnvId = Json.Text(envs[0]?["id"]);
        var serverKeys = Json.Array(envs[0]?["secrets"]).Where(s => string.Equals(Json.Text(s?["type"]), "server", StringComparison.OrdinalIgnoreCase)).Select(s => Json.Text(s?["value"])).Where(v => v.Length > 0).ToArray();
        var provided = Environment.GetEnvironmentVariable("FEATBIT_UI_SDK_KEY");
        if (!string.IsNullOrEmpty(provided) && !serverKeys.Contains(provided)) throw new Stop("Provided Server SDK key is not listed in the selected environment.");
        SdkKey = provided ?? serverKeys.FirstOrDefault() ?? throw new Stop("No Server SDK key is available for the selected environment.");
    }
    private static async Task<JsonNode> Decode(HttpResponseMessage response)
    {
        if (!response.IsSuccessStatusCode) throw new Stop($"Management API returned HTTP {(int)response.StatusCode}. Response body omitted to protect credentials.");
        var root = JsonNode.Parse(await response.Content.ReadAsStringAsync()) ?? throw new Stop("Management API returned an empty document.");
        if (root is JsonObject obj && obj["success"]?.GetValue<bool>() == false) throw new Stop("Management API returned success=false. Inspect the service logs.");
        return root is JsonObject wrap && wrap.ContainsKey("data") ? wrap["data"]?.DeepClone() ?? new JsonObject() : root;
    }
    public async Task<JsonNode> Get(string path)
    {
        if (!path.StartsWith("/api/v1/", StringComparison.Ordinal)) throw new Stop("Unexpected management read route.");
        using var response = await http.GetAsync(path); return await Decode(response);
    }
    public static JsonArray Items(JsonNode? value) => value as JsonArray ?? Json.Array(value?["items"]);
    public async Task<Target> Resolve(Scenario c)
    {
        var matches = new List<JsonNode>();
        for (var page = 0; page < 100; page++)
        {
            var data = await Get($"/api/v1/envs/{EnvId}/experiments?name={Uri.EscapeDataString(c.ExperimentName)}&pageIndex={page}&pageSize=100");
            var items = Items(data);
            matches.AddRange(items.Where(e => Json.Text(e?["name"]) == c.ExperimentName).Select(e => e!));
            if (items.Count < 100) break;
            if (page == 99) throw new Stop("Experiment search exceeded pagination limit.");
        }
        if (matches.Count != 1) throw new Stop($"Expected experiment not found uniquely: {c.ExperimentName}. Complete UI initialization first.");
        var experiment = await Get($"/api/v1/envs/{EnvId}/experiments/{Json.Text(matches[0]["id"])}");
        var flag = Json.Object(await Get($"/api/v1/envs/{EnvId}/feature-flags/{Uri.EscapeDataString(c.FlagKey)}"));
        return ValidateTarget(c, experiment, flag, ProjectId, EnvId);
    }
    public static Target ValidateTarget(Scenario c, JsonNode experiment, JsonObject flag, string projectId, string envId)
    {
        var check = new Checks();
        check.Add("Experiment flag", Json.Text(experiment["flagKey"]) == c.FlagKey);
        check.Add("Experiment environment", Json.Text(experiment["featBitEnvId"]) == envId);
        check.Add("Flag environment", flag["envId"] == null || Json.Text(flag["envId"]) == envId);
        var runs = Json.Array(experiment["experimentRuns"]);
        check.Add("Exactly one Run 1", runs.Count == 1); check.Require();
        var run = Json.Object(runs[0]);
        check.Add("Run number", Json.Text(run["slug"]) == "run-1", "Expected the existing Run 1 (run-1).");
        check.Add("SDK event data source", Json.Text(run["dataSourceMode"]) is "" or "featbit-managed", "Use the FeatBit-managed data source for SDK events.");
        check.Add("Run method", Json.Text(run["method"]) == (c.Bandit ? "bandit" : "bayesian_ab"), "actual=" + Json.Text(run["method"]));
        check.Add("Flag enabled", flag["isEnabled"]?.GetValue<bool>() == true && flag["isArchived"]?.GetValue<bool>() != true, "Enable the flag before data collection.");
        check.Add("Flag type", Json.Text(flag["variationType"]) == c.ValueType, "expected=" + c.ValueType);
        var variants = Json.Array(flag["variations"]);
        var variantsMatch = variants.Count == c.Values.Length && variants.Select(v => Json.Text(v?["value"])).Order().SequenceEqual(c.Values.Order());
        check.Add("Exact variant values", variantsMatch);
        if (!variantsMatch) check.Require();
        var ids = variants.ToDictionary(v => Json.Text(v?["value"]), v => Json.Text(v?["id"]));
        check.Add("Control role", Json.Text(run["controlVariant"]) == ids[c.Values[0]]);
        var treatments = Json.Text(run["treatmentVariant"]).Split(['|', ','], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        check.Add("Treatment roles", treatments.Order().SequenceEqual(c.Values.Skip(1).Select(v => ids[v]).Order()));
        check.Add("Assignment unit", Json.Text(run["assignmentUnitSelector"]) is "user.keyId" or "user.key" or "keyId");
        check.Add("No audience filters", Json.Text(run["audienceFilters"]) is "" or "[]" or "{}");
        check.Add("Layer binding", Json.Text(run["layerKey"]) == (c.LayerKey ?? ""));
        if (c.LayerKey != null) { check.Equal("Layer slice start", run["sliceStart"]?.GetValue<double>() ?? -1, c.SliceStart); check.Equal("Layer slice end", run["sliceEnd"]?.GetValue<double>() ?? -1, c.SliceEnd); }
        var sampling = Json.Array(Json.ParseField(run["analysisSamplingPlan"]));
        var defaultSampling = c.LayerKey == null && string.IsNullOrWhiteSpace(Json.Text(run["analysisSamplingPlan"])) && string.IsNullOrWhiteSpace(Json.Text(run["allocationPlan"])) &&
            (run["trafficPercent"]?.GetValue<double>() ?? 100) == 100 && (run["trafficOffset"]?.GetValue<double>() ?? 0) == 0;
        var explicitSampling = sampling.Count == c.Values.Length && sampling.All(p => p?["includeRate"]?.GetValue<double>() == 100 && ids.Values.Contains(Json.Text(p?["variation"])) && Json.Text(p?["role"]) == (Json.Text(p?["variation"]) == ids[c.Values[0]] ? "control" : "treatment")) && sampling.Select(p => Json.Text(p?["variation"])).Distinct().Count() == ids.Count;
        check.Add("Analysis sampling includes all selected roles", defaultSampling || explicitSampling, "Use explicit 100% role sampling, or the no-Layer 100% default without legacy allocation filters.");
        var primary = Json.ParseField(experiment["primaryMetric"]);
        var guards = Json.Array(Json.ParseField(run["guardrailEvents"]));
        var exposureGuards = Json.Array(Json.ParseField(experiment["guardrails"]));
        check.Add("Guardrail count", guards.Count == c.Metrics.Length - 1);
        check.Add("Exposure guardrail count", exposureGuards.Count == c.Metrics.Length - 1);
        foreach (var (m, i) in c.Metrics.Select((m, i) => (m, i)))
        {
            var definition = i == 0 ? primary : guards.FirstOrDefault(g => Json.Text(g?["event"]) == m.Key);
            check.Add("Metric definition " + m.Key, definition != null && Json.Text(definition["event"]) == m.Key && Json.Text(definition["metricType"]) == m.Type && Json.Text(definition["metricAgg"]) == m.Agg);
            var inverse = i == 0 ? Json.Text(definition?["expectedDirection"]) == "decrease_good" : definition?["inverse"]?.GetValue<bool>() ?? Json.Text(definition?["direction"]) == "increase_bad";
            check.Add("Metric direction " + m.Key, definition != null && inverse == m.Inverse);
            if (i > 0)
            {
                var exposure = exposureGuards.FirstOrDefault(g => Json.Text(g?["event"]) == m.Key);
                check.Add("Exposure guardrail definition " + m.Key, exposure != null && Json.Text(exposure["metricType"]) == m.Type && Json.Text(exposure["metricAgg"]) == m.Agg && Json.Text(exposure["direction"]) == m.Direction);
            }
            if (i == 0) check.Add("Run primary snapshot", Json.Text(run["primaryMetricEvent"]) == m.Key && Json.Text(run["primaryMetricType"]) == m.Type && Json.Text(run["primaryMetricAgg"]) == m.Agg);
        }
        var rules = Json.Array(flag["rules"]);
        var fallthrough = flag["fallthrough"];
        check.Add("No targeting rules", rules.Count == 0, "Configure traffic split only in Default rule / When flag is ON.");
        check.Add("No individual targeting", Json.Array(flag["targetUsers"]).Count == 0, "All test users must reach the default split.");
        check.Add("Default experiment collection enabled", fallthrough?["includedInExpt"]?.GetValue<bool>() == true, "Enable experiment collection on the default split.");
        check.Add("Default dispatch by user key", Json.Text(fallthrough?["dispatchKey"]) is "keyId" or "key");
        check.Require();
        var weights = new Dictionary<string, double>(); var end = 0d;
        foreach (var variation in Json.Array(fallthrough?["variations"]))
        {
            var range = Json.Array(variation?["rollout"]);
            var id = Json.Text(variation?["id"]);
            if (range.Count != 2 || !ids.Values.Contains(id) || weights.ContainsKey(id)) throw new Stop("Invalid or duplicate rollout interval.");
            var lo = range[0]!.GetValue<double>(); var hi = range[1]!.GetValue<double>();
            if (!double.IsFinite(lo) || !double.IsFinite(hi) || Math.Abs(lo - end) > 1e-8 || hi <= lo || hi > 1) throw new Stop("Rollout intervals must be contiguous, positive and within 0..1.");
            if (flag["exptIncludeAllTargets"]?.GetValue<bool>() != true && variation?["exptRollout"]?.GetValue<double>() != 1) throw new Stop("Experiment exposure collection must include all served users.");
            weights[id] = hi - lo; end = hi;
        }
        if (Math.Abs(end - 1) > 1e-8 || weights.Count != ids.Count) throw new Stop("Rollout must cover all variants and total 100%.");
        var safeRun = new JsonObject();
        safeRun["slug"] = run["slug"]?.DeepClone(); safeRun["dataSourceMode"] = run["dataSourceMode"]?.DeepClone();
        foreach (var key in new[] { "id", "method", "controlVariant", "treatmentVariant", "primaryMetricEvent", "primaryMetricType", "primaryMetricAgg", "guardrailEvents", "minimumSample", "observationStart", "observationEnd", "priorProper", "priorMean", "priorStddev", "layerId", "layerKey", "assignmentUnitSelector", "allocationKeySelector", "sliceStart", "sliceEnd", "layerTrafficPercent", "analysisSamplingPlan", "allocationPlan", "trafficPercent", "trafficOffset", "audienceFilters" }) safeRun[key] = run[key]?.DeepClone();
        var fingerprint = safeRun.DeepClone().AsObject(); fingerprint.Remove("observationStart"); fingerprint.Remove("observationEnd");
        return new Target { CaseId = c.Id, ProjectId = projectId, EnvId = envId, ExperimentId = Json.Text(experiment["id"]), RunId = Json.Text(run["id"]), VariationIds = ids, Weights = weights, Flag = flag.DeepClone().AsObject(), Run = safeRun, ConfigHash = Json.Hash(new { projectId, envId, experiment = Json.Text(experiment["id"]), run = fingerprint, ids, metricDirections = c.Metrics.Select(m => m.Direction) }) };
    }
    public async Task<JsonNode> Run(Target target)
    {
        var detail = await Get($"/api/v1/envs/{EnvId}/experiments/{target.ExperimentId}");
        return Json.Array(detail["experimentRuns"]).Single(r => Json.Text(r?["id"]) == target.RunId)!.DeepClone();
    }
    public async Task<JsonNode> Stats(Target target, Scenario c, MetricSpec m, DateTimeOffset start, DateTimeOffset end, bool includeLayer = true)
    {
        var body = new JsonObject { ["envId"] = EnvId, ["flagKey"] = c.FlagKey, ["metricEvent"] = m.Key, ["metricType"] = m.Type, ["metricAgg"] = m.Agg,
            ["startDate"] = start.UtcDateTime.ToString("yyyy-MM-dd"), ["endDate"] = end.UtcDateTime.ToString("yyyy-MM-dd"), ["startTime"] = start.UtcDateTime, ["endTime"] = end.UtcDateTime };
        // Omit RunId: this read-only query must not upsert experiment_run_assignments.
        foreach (var key in new[] { "controlVariant", "layerId", "layerKey", "assignmentUnitSelector", "allocationKeySelector", "sliceStart", "sliceEnd", "layerTrafficPercent", "analysisSamplingPlan", "trafficPercent", "trafficOffset" }) body[key] = target.Run[key]?.DeepClone();
        body["treatmentVariants"] = target.Run["treatmentVariant"]?.DeepClone();
        if (!includeLayer)
            foreach (var key in new[] { "layerId", "layerKey", "sliceStart", "sliceEnd", "layerTrafficPercent" }) body.Remove(key);
        using var response = await http.PostAsJsonAsync($"/api/v1/envs/{EnvId}/experiment-stats/query", body);
        return await Decode(response);
    }
    public void Dispose() => http.Dispose();
}
