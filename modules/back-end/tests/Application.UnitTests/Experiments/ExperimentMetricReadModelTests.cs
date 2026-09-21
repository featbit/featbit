using Application.Experiments.ExperimentMetrics;
using Domain.Experiments;

namespace Application.UnitTests.Experiments;

public class ExperimentMetricReadModelTests
{
    [Fact]
    public void Build_DistinguishesMetricsSharingTheSameEvent_ById()
    {
        var primary = NewMetric("purchase_conversion");
        var guardrail = NewMetric("purchase_amount");
        var run = NewRun("run-1", primary);
        // Identity remains correct even if the display key differs from the registry.
        run.PrimaryMetric = new PrimaryMetricConfig { MetricId = primary.Id, MetricKey = "snapshot_key", EventName = "purchase" };
        run.GuardrailMetrics = [new GuardrailMetricConfig { MetricId = guardrail.Id, MetricKey = guardrail.Key, EventName = "purchase" }];
        var experiment = new ExperimentWithRuns
        {
            Experiment = new Experiment { Id = Guid.NewGuid(), Name = "Checkout" },
            Runs = [run]
        };
        Assert.Equal("primary", Assert.Single(ExperimentMetricReadModel.Build(primary, experiment).Runs).Role);
        Assert.Equal("guardrail", Assert.Single(ExperimentMetricReadModel.Build(guardrail, experiment).Runs).Role);
    }

    [Fact]
    public void Build_ReturnsEveryReferencingRun_EvenWhenExperimentDefaultsDiffer()
    {
        var metric = NewMetric("checkout_completed");
        var experiment = new ExperimentWithRuns
        {
            Experiment = new Experiment
            {
                Id = Guid.NewGuid(), Name = "Pricing experiment",
                PrimaryMetric = new PrimaryMetricConfig { MetricId = Guid.NewGuid(), MetricKey = "new_default", EventName = "purchase_v2" }
            },
            Runs = [NewRun("run-3", metric), NewRun("run-2", NewMetric("other_metric"), metric), NewRun("run-1", NewMetric("other_metric"))]
        };
        var usage = ExperimentMetricReadModel.Build(metric, experiment);
        Assert.NotNull(usage);
        Assert.Equal(2, usage.Runs.Count);
        Assert.Contains(usage.Runs, x => x.Key == "run-3" && x.Role == "primary");
        Assert.Contains(usage.Runs, x => x.Key == "run-2" && x.Role == "guardrail");
        Assert.DoesNotContain(usage.Runs, x => x.Key == "run-1");
    }

    [Fact]
    public void Build_MissingRunSnapshot_DoesNotUseExperimentDefaults()
    {
        var metric = NewMetric("purchase");
        var experiment = new ExperimentWithRuns
        {
            Experiment = new Experiment { PrimaryMetric = new PrimaryMetricConfig { MetricId = metric.Id, MetricKey = metric.Key } },
            Runs = [new ExperimentRun { Id = Guid.NewGuid(), Slug = "run-1" }]
        };
        Assert.Null(ExperimentMetricReadModel.Build(metric, experiment));
    }

    [Fact]
    public void GetReferencedIds_IncludesExperimentDefaultsAndRunSnapshots()
    {
        var primary = NewMetric("revenue");
        var guardrail = NewMetric("errors");
        var previousPrimary = NewMetric("activation");
        var previousGuardrail = NewMetric("retention");
        var experiment = new ExperimentWithRuns
        {
            Experiment = new Experiment
            {
                PrimaryMetric = new PrimaryMetricConfig { MetricId = primary.Id, MetricKey = "snapshot_revenue" },
                GuardrailMetrics = [new GuardrailMetricConfig { MetricId = guardrail.Id, MetricKey = guardrail.Key }]
            },
            Runs = [NewRun("run-1", previousPrimary, previousGuardrail), NewRun("run-2", primary)]
        };
        Assert.Equal(new[] { primary.Id, guardrail.Id, previousPrimary.Id, previousGuardrail.Id }.OrderBy(id => id),
            ExperimentMetricReadModel.GetReferencedIds(experiment).OrderBy(id => id));
    }

    [Fact]
    public void Build_DoesNotMatchAnotherMetricWithTheSameKey()
    {
        var metric = NewMetric("purchase");
        var experiment = new ExperimentWithRuns
        {
            Experiment = new Experiment { Id = Guid.NewGuid(), Name = "Checkout" },
            Runs = [NewRun("run-1", NewMetric(metric.Key))]
        };

        Assert.Null(ExperimentMetricReadModel.Build(metric, experiment));
    }

    private static ExperimentMetric NewMetric(string key) => new() { Id = Guid.NewGuid(), Key = key, Name = "Metric", Status = "active" };

    private static ExperimentRun NewRun(string slug, ExperimentMetric primary, params ExperimentMetric[] guardrails) => new()
    {
        Id = Guid.NewGuid(), Slug = slug,
        PrimaryMetric = new PrimaryMetricConfig { MetricId = primary.Id, MetricKey = primary.Key, EventName = "purchase" },
        GuardrailMetrics = guardrails.Select(metric => new GuardrailMetricConfig { MetricId = metric.Id, MetricKey = metric.Key, EventName = "purchase" }).ToList(),
        CreatedAt = DateTime.UtcNow
    };
}
