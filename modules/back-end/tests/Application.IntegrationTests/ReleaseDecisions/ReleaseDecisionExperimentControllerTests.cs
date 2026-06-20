namespace Application.IntegrationTests.ReleaseDecisions;

[Collection(nameof(TestApp))]
public class ReleaseDecisionExperimentControllerTests
{
    private readonly TestApp _app;

    public ReleaseDecisionExperimentControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task Create_RequestValidation()
    {
        var response = await _app.PostAsync(
            $"/api/v1/envs/{TestWorkspace.Id}/release-decision/experiments",
            new { name = " " });

        await Verify(response);
    }

    [Fact]
    public async Task Update_RequestValidation()
    {
        var response = await _app.PutAsync(
            $"/api/v1/envs/{TestWorkspace.Id}/release-decision/experiments/{TestReleaseDecisionExperimentService.ExperimentId}",
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
            $"/api/v1/envs/{TestWorkspace.Id}/release-decision/experiments/{TestReleaseDecisionExperimentService.ExperimentId}/metrics",
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
            $"/api/v1/envs/{TestWorkspace.Id}/release-decision/experiments/{TestReleaseDecisionExperimentService.ExperimentId}/runs/{TestReleaseDecisionExperimentService.RunId}/analyze",
            new { forceFresh = true });

        await Verify(response);
    }
}
