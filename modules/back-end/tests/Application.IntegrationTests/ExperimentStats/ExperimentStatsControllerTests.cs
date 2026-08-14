namespace Application.IntegrationTests.ExperimentStats;

[Collection(nameof(TestApp))]
public class ExperimentStatsControllerTests
{
    private readonly TestApp _app;
    private static readonly string QueryPath = $"/api/v1/envs/{TestWorkspace.Id}/experiment-stats/query";

    public ExperimentStatsControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task Query_RequestValidation()
    {
        var response = await _app.PostAsync(
            QueryPath,
            new
            {
                flagKey = "",
                metricEvent = "",
                startDate = "2026-06-10",
                endDate = "2026-06-01",
                metricType = "unsupported",
                metricAgg = "median"
            });

        await Verify(response);
    }

    [Fact]
    public async Task Query()
    {
        var response = await _app.PostAsync(
            QueryPath,
            new
            {
                flagKey = "checkout-onboarding",
                metricEvent = "checkout_activated",
                startDate = "2026-06-01",
                endDate = "2026-06-10",
                metricType = "binary",
                metricAgg = "once"
            });

        await Verify(response);
    }

    [Fact]
    public async Task OpenApiAccessToken_CanQueryExperimentStats()
    {
        var response = await _app.PostWithAccessTokenAsync(
            QueryPath,
            new
            {
                flagKey = "checkout-onboarding",
                metricEvent = "checkout_activated",
                startDate = "2026-06-01",
                endDate = "2026-06-10",
                metricType = "binary",
                metricAgg = "once"
            });

        Assert.True(
            response.IsSuccessStatusCode,
            $"Expected success but got {(int)response.StatusCode} {response.ReasonPhrase}.");
    }
}
