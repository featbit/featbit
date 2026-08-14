using System.Text.Json;

namespace Application.IntegrationTests.Experiments;

[Collection(nameof(TestApp))]
public class ExperimentControllerTests
{
    private readonly TestApp _app;
    private static readonly string BasePath =
        $"/api/v1/envs/{TestWorkspace.Id}/experiments";

    public ExperimentControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task Create_RequestValidation()
    {
        var response = await _app.PostAsync(
            BasePath,
            new { name = " " });

        await Verify(response);
    }

    [Fact]
    public async Task Update_RequestValidation()
    {
        var response = await _app.PutAsync(
            $"{BasePath}/{TestExperimentService.ExperimentId}",
            new
            {
                primaryMetric = "activation",
                guardrails = "[]"
            });

        await Verify(response);
    }

    [Fact]
    public async Task UpdateMetrics_RequestValidation()
    {
        var response = await _app.PutAsync(
            $"{BasePath}/{TestExperimentService.ExperimentId}/metrics",
            new
            {
                metricName = "",
                metricEvent = "checkout activated",
                metricType = "unsupported",
                metricAgg = "median",
                expectedDirection = "flat",
                guardrails = "[{\"event\":\"latency\",\"metricType\":\"binary\",\"metricAgg\":\"once\"}]"
            });

        await Verify(response);
    }

    [Fact]
    public async Task AnalyzeRun()
    {
        var response = await _app.PostAsync(
            $"{BasePath}/{TestExperimentService.ExperimentId}/runs/{TestExperimentService.RunId}/analyze",
            new { forceFresh = true });

        await Verify(response);
    }

    [Fact]
    public async Task MetricUpdate_PersistsTypeAndAggregation()
    {
        var metricsPath = $"/api/v1/envs/{TestWorkspace.Id}/experiment-metrics";
        var metricKey = $"metric_update_{Guid.NewGuid():N}";

        var create = await _app.PostWithAccessTokenAsync(metricsPath, new
        {
            name = "Metric update persistence",
            key = metricKey,
            metricType = "binary",
            metricAgg = "once",
            status = "active"
        });
        create.EnsureSuccessStatusCode();
        var metricId = GetJsonString(await create.Content.ReadAsStringAsync(), "data", "id");

        var update = await _app.PutWithAccessTokenAsync($"{metricsPath}/{metricId}", new
        {
            name = "Metric update persistence",
            key = metricKey,
            metricType = "continuous",
            metricAgg = "sum",
            status = "active"
        });
        update.EnsureSuccessStatusCode();

        var list = await _app.GetWithAccessTokenAsync($"{metricsPath}?key={metricKey}&pageIndex=0&pageSize=10");
        list.EnsureSuccessStatusCode();
        var listJson = await list.Content.ReadAsStringAsync();

        Assert.Equal("continuous", GetJsonString(listJson, "data", "items", "0", "metricType"));
        Assert.Equal("sum", GetJsonString(listJson, "data", "items", "0", "metricAgg"));
    }

    [Fact]
    public async Task OpenApiAccessToken_CanUseExperimentApi()
    {
        var experimentId = TestExperimentService.ExperimentId;
        var runId = TestExperimentService.RunId;
        var experimentPath = $"{BasePath}/{experimentId}";
        var runPath = $"{experimentPath}/runs/{runId}";
        var metricsPath = $"/api/v1/envs/{TestWorkspace.Id}/experiment-metrics";
        var metricKey = $"checkout_activated_{Guid.NewGuid():N}";

        var responses = new[]
        {
            await _app.PostWithAccessTokenAsync(BasePath, new
            {
                name = "Token-created experiment",
                description = "Created through OpenAPI access token"
            }),
            await _app.GetWithAccessTokenAsync(BasePath),
            await _app.GetWithAccessTokenAsync(experimentPath),
            await _app.PutWithAccessTokenAsync(experimentPath, new
            {
                goal = "Increase activated checkout users"
            }),
            await _app.PutWithAccessTokenAsync($"{experimentPath}/stage", new
            {
                stage = "measuring"
            }),
            await _app.PostWithAccessTokenAsync(metricsPath, new
            {
                name = "Activation",
                key = metricKey,
                metricType = "binary",
                metricAgg = "once"
            }),
            await _app.PutWithAccessTokenAsync($"{experimentPath}/metrics", new
            {
                metricKey,
                expectedDirection = "increase_good",
                guardrails = "[]"
            }),
            await _app.PostWithAccessTokenAsync($"{experimentPath}/runs", new { }),
            await _app.PutWithAccessTokenAsync(runPath, new
            {
                status = "collecting",
                decision = "INCONCLUSIVE"
            }),
            await _app.PutWithAccessTokenAsync($"{runPath}/audience", new
            {
                method = "bayesian_ab",
                controlVariant = "control",
                treatmentVariant = "treatment",
                assignmentUnitSelector = "user.keyId",
                layerKey = "checkout",
                layerTrafficPercent = 30,
                analysisSamplingPlan = "[{\"variation\":\"control\",\"role\":\"control\",\"includeRate\":11.111111},{\"variation\":\"treatment\",\"role\":\"treatment\",\"includeRate\":100}]"
            }),
            await _app.PutWithAccessTokenAsync($"{runPath}/observation-window", new
            {
                observationStart = "2026-06-01T00:00:00Z",
                observationEnd = "2026-06-10T00:00:00Z"
            }),
            await _app.PostWithAccessTokenAsync($"{runPath}/analyze", new
            {
                forceFresh = true
            }),
            await _app.DeleteWithAccessTokenAsync(runPath),
            await _app.DeleteWithAccessTokenAsync(experimentPath)
        };

        Assert.All(responses, response => Assert.True(
            response.IsSuccessStatusCode,
            $"Expected success but got {(int)response.StatusCode} {response.ReasonPhrase}."));
    }

    private static string GetJsonString(string json, params string[] path)
    {
        using var document = JsonDocument.Parse(json);
        var current = document.RootElement;
        foreach (var segment in path)
        {
            current = current.ValueKind == JsonValueKind.Array
                ? current[Convert.ToInt32(segment)]
                : current.GetProperty(segment);
        }

        return current.GetString()!;
    }
}
