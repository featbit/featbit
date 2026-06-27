namespace Application.IntegrationTests.ReleaseDecisions;

[Collection(nameof(TestApp))]
public class ReleaseDecisionExperimentControllerTests
{
    private readonly TestApp _app;
    private static readonly string BasePath =
        $"/api/v1/envs/{TestWorkspace.Id}/release-decision/experiments";

    public ReleaseDecisionExperimentControllerTests(TestApp app)
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
            $"{BasePath}/{TestReleaseDecisionExperimentService.ExperimentId}",
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
            $"{BasePath}/{TestReleaseDecisionExperimentService.ExperimentId}/metrics",
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
            $"{BasePath}/{TestReleaseDecisionExperimentService.ExperimentId}/runs/{TestReleaseDecisionExperimentService.RunId}/analyze",
            new { forceFresh = true });

        await Verify(response);
    }

    [Fact]
    public async Task OpenApiAccessToken_CanUseReleaseDecisionExperimentApi()
    {
        var experimentId = TestReleaseDecisionExperimentService.ExperimentId;
        var runId = TestReleaseDecisionExperimentService.RunId;
        var experimentPath = $"{BasePath}/{experimentId}";
        var runPath = $"{experimentPath}/runs/{runId}";

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
            await _app.PutWithAccessTokenAsync($"{experimentPath}/metrics", new
            {
                metricName = "Activation",
                metricEvent = "checkout_activated",
                metricType = "binary",
                metricAgg = "once",
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
}
