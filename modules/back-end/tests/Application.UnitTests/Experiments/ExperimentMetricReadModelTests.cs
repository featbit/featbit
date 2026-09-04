using Application.Experiments.ExperimentMetrics;
using Domain.Experiments;

namespace Application.UnitTests.Experiments;

public class ExperimentMetricReadModelTests
{
    [Fact]
    public void Build_ReturnsEveryReferencingRun()
    {
        var metric = NewMetric("checkout_completed");
        var experimentWithRuns = new ExperimentWithRuns
        {
            Experiment = new Experiment
            {
                Id = Guid.NewGuid(),
                Name = "Pricing experiment",
                PrimaryMetric = "{\"event\":\"checkout_completed\"}",
                Guardrails = "[{\"metricKey\":\"api_errors\"}]"
            },
            Runs =
            [
                NewRun("run-3", "running", "checkout_completed", "[]"),
                NewRun("run-2", "completed", "other_metric", "[\"checkout_completed\"]"),
                NewRun("run-1", "stopped", "other_metric", "[]")
            ]
        };

        var usage = ExperimentMetricReadModel.Build(metric, experimentWithRuns);

        Assert.NotNull(usage);
        Assert.Equal(2, usage.Runs.Count);
        Assert.Contains(usage.Runs, x => x.Key == "run-3" && x.Role == "primary" && x.Status == "running");
        Assert.Contains(usage.Runs, x => x.Key == "run-2" && x.Role == "guardrail" && x.Status == "completed");
        Assert.DoesNotContain(usage.Runs, x => x.Key == "run-1");
    }

    [Fact]
    public void Build_CurrentExperimentReferenceWithoutRun_ReturnsNull()
    {
        var metric = NewMetric("checkout_completed");
        var experimentWithRuns = new ExperimentWithRuns
        {
            Experiment = new Experiment
            {
                Id = Guid.NewGuid(),
                Name = "Pricing experiment",
                PrimaryMetric = "{\"event\":\"checkout_completed\"}"
            },
            Runs = []
        };

        var usage = ExperimentMetricReadModel.Build(metric, experimentWithRuns);

        Assert.Null(usage);
    }

    [Fact]
    public void GetReferencedKeys_ReadsCurrentAndLegacyShapes()
    {
        var experimentWithRuns = new ExperimentWithRuns
        {
            Experiment = new Experiment
            {
                PrimaryMetric = "{\"metricKey\":\"revenue\"}",
                Guardrails = "[{\"key\":\"errors\"},\"latency\"]"
            },
            Runs =
            [
                NewRun("run-1", "completed", "activation", "[{\"event\":\"retention\"}]")
            ]
        };

        var keys = ExperimentMetricReadModel.GetReferencedKeys(experimentWithRuns);

        Assert.Equal(
            ["activation", "errors", "latency", "retention", "revenue"],
            keys.OrderBy(x => x));
    }

    private static ExperimentMetric NewMetric(string key) => new()
    {
        Id = Guid.NewGuid(),
        Key = key,
        Name = "Metric",
        Status = "active"
    };

    private static ExperimentRun NewRun(
        string key,
        string status,
        string primaryMetric,
        string guardrails) => new()
        {
            Id = Guid.NewGuid(),
            Slug = key,
            Status = status,
            PrimaryMetricEvent = primaryMetric,
            GuardrailEvents = guardrails,
            CreatedAt = DateTime.UtcNow
        };
}
