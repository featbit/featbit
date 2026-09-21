using System.Text.Json;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Experiments;
using Application.Experiments.ExperimentMetrics;
using Domain.Experiments;
using Domain.FeatureFlags;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace Infrastructure.IntegrationTests.Experiments;

[Collection(nameof(ExperimentProviderParityCollection))]
public class ExperimentMetricEventNameTests(ExperimentProviderParityFixture fixture) : IntegrationTestBase
{
    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task Catalog_PersistsEventNamesIndependentlyOfKeys_AndFindsReferencedIds(string provider)
    {
        var (envId, _, _, primary, guardrail) = await CreateConfiguredRunAsync(provider);
        var metrics = fixture.CreateExperimentMetricService(provider);
        Assert.Equal("purchase", primary.EventName);
        Assert.Equal(primary.EventName, guardrail.EventName);
        var catalog = await fixture.CreateExperimentMetricService(provider)
            .GetListAsync(envId, new ExperimentMetricFilter { PageSize = 10 }, []);
        Assert.Equal(2, catalog.Items.Count);
        Assert.All(catalog.Items, metric => Assert.Equal("purchase", metric.EventName));

        var referencedMetrics = await metrics.GetListAsync(envId,
            new ExperimentMetricFilter { SearchText = "unmatched experiment title" }, [primary.Id]);
        Assert.Equal(primary.Id, Assert.Single(referencedMetrics.Items).Id);
        var changed = await metrics.UpdateAsync(envId, primary.Id, new UpdateExperimentMetricRequest
        {
            Name = "Changed name", EventName = "purchase_v2", Description = "Changed description",
            MetricType = "numeric", MetricAgg = "average"
        });
        Assert.Equal("purchase_v2", changed.EventName);
        Assert.Equal(primary.Key, changed.Key);
        var readBack = await fixture.CreateExperimentMetricService(provider).GetBySelectorAsync(envId, primary.Id, null);
        Assert.Equal("purchase_v2", readBack.EventName);
        Assert.Equal(primary.Key, readBack.Key);
    }

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task Analysis_UsesSdkEventName_AndKeepsSharedEventMetricsSeparate(string provider)
    {
        var (envId, experimentId, run, primary, guardrail) = await CreateConfiguredRunAsync(provider);
        await SeedInsightsAsync(provider, envId, run.ObservationStart!.Value);
        var analyzed = await fixture.CreateExperimentServices(provider).ExperimentService
            .AnalyzeRunAsync(envId, experimentId, run.Id, new ExperimentRunAnalyzeRequest());
        var result = Assert.Single(analyzed.ExperimentRuns);
        Assert.Equal(primary.Key, result.PrimaryMetric.MetricKey);
        Assert.Equal("purchase", result.PrimaryMetric.EventName);
        using var analysis = JsonDocument.Parse(result.AnalysisResult);
        var primarySection = analysis.RootElement.GetProperty("primary_metric");
        var guardrailSection = Assert.Single(analysis.RootElement.GetProperty("guardrails").EnumerateArray());
        Assert.Equal(primary.Key, primarySection.GetProperty("metricKey").GetString());
        Assert.Equal(guardrail.Key, guardrailSection.GetProperty("metricKey").GetString());
        Assert.Equal("purchase", primarySection.GetProperty("event").GetString());
        Assert.Equal("purchase", guardrailSection.GetProperty("event").GetString());
        var primaryControl = primarySection.GetProperty("rows").EnumerateArray()
            .Single(row => row.GetProperty("variant").GetString() == "control");
        var amountControl = guardrailSection.GetProperty("rows").EnumerateArray()
            .Single(row => row.GetProperty("variant").GetString() == "control");
        Assert.Equal(10, primaryControl.GetProperty("n").GetInt64());
        Assert.Equal(0.5, primaryControl.GetProperty("rate").GetDouble(), 6);
        Assert.Equal(5, amountControl.GetProperty("mean").GetDouble(), 6);
        Assert.Equal(primary.Id, result.PrimaryMetric.MetricId);
        Assert.Equal(guardrail.Id, Assert.Single(result.GuardrailMetrics).MetricId);
    }

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task Reanalysis_PreservesRunSnapshotsAndResults_AfterMetricChangesAndArchival(string provider)
    {
        var (envId, experimentId, run, primary, guardrail) = await CreateConfiguredRunAsync(provider);
        await SeedInsightsAsync(provider, envId, run.ObservationStart!.Value);
        var service = fixture.CreateExperimentServices(provider).ExperimentService;
        var analyzed = await service.AnalyzeRunAsync(envId, experimentId, run.Id, new ExperimentRunAnalyzeRequest());
        var result = Assert.Single(analyzed.ExperimentRuns);
        var originalPrimary = result.PrimaryMetric;
        var originalGuardrail = Assert.Single(result.GuardrailMetrics);
        using var analysis = JsonDocument.Parse(result.AnalysisResult);

        var newDefaults = await ChangeMetricDefaultsAsync(provider, envId, experimentId, primary.Id, guardrail.Id);
        var metrics = fixture.CreateExperimentMetricService(provider);
        Assert.Equal("purchase_v2", newDefaults.PrimaryMetric.EventName);
        Assert.Equal(originalPrimary, Assert.Single(newDefaults.ExperimentRuns).PrimaryMetric);
        Assert.Equal(originalGuardrail, Assert.Single(Assert.Single(newDefaults.ExperimentRuns).GuardrailMetrics));
        await metrics.ArchiveAsync(envId, primary.Id);
        await metrics.ArchiveAsync(envId, guardrail.Id);
        var reanalyzed = await fixture.CreateExperimentServices(provider).ExperimentService
            .AnalyzeRunAsync(envId, experimentId, run.Id, new ExperimentRunAnalyzeRequest { ForceFresh = true });
        var historicalRun = Assert.Single(reanalyzed.ExperimentRuns);
        using var historicalAnalysis = JsonDocument.Parse(historicalRun.AnalysisResult);
        Assert.True(JsonElement.DeepEquals(analysis.RootElement.GetProperty("primary_metric"),
            historicalAnalysis.RootElement.GetProperty("primary_metric")), "Historical primary metric analysis changed.");
        Assert.True(JsonElement.DeepEquals(analysis.RootElement.GetProperty("guardrails"),
            historicalAnalysis.RootElement.GetProperty("guardrails")), "Historical guardrail analysis changed.");
        Assert.Equal(originalPrimary, historicalRun.PrimaryMetric);
        Assert.Equal(originalGuardrail, Assert.Single(historicalRun.GuardrailMetrics));
    }

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task CreateRun_UsesUpdatedDefaultsAfterArchival_AndPreservesPreviousRun(string provider)
    {
        var (envId, experimentId, run, primary, guardrail) = await CreateConfiguredRunAsync(provider);
        var originalPrimary = run.PrimaryMetric;
        var originalGuardrail = Assert.Single(run.GuardrailMetrics);
        var newDefaults = await ChangeMetricDefaultsAsync(provider, envId, experimentId, primary.Id, guardrail.Id);
        var metrics = fixture.CreateExperimentMetricService(provider);
        await metrics.ArchiveAsync(envId, primary.Id);
        await metrics.ArchiveAsync(envId, guardrail.Id);
        var withNewRun = await fixture.CreateExperimentServices(provider).ExperimentService.CreateRunAsync(envId, experimentId);
        var next = Assert.Single(withNewRun.ExperimentRuns, saved => saved.Id != run.Id);
        Assert.Equal(newDefaults.PrimaryMetric, next.PrimaryMetric);
        Assert.Equal(Assert.Single(newDefaults.GuardrailMetrics), Assert.Single(next.GuardrailMetrics));
        Assert.Equal("decrease_good", next.PrimaryMetric.ExpectedDirection);
        Assert.Equal("average", next.PrimaryMetric.MetricAgg);
        Assert.Equal("increase_bad", Assert.Single(next.GuardrailMetrics).Direction);
        Assert.Equal(originalPrimary, Assert.Single(withNewRun.ExperimentRuns, saved => saved.Id == run.Id).PrimaryMetric);
        Assert.Equal(originalGuardrail, Assert.Single(Assert.Single(withNewRun.ExperimentRuns, saved => saved.Id == run.Id).GuardrailMetrics));
        using var response = JsonDocument.Parse(JsonSerializer.Serialize(withNewRun, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        Assert.Equal(JsonValueKind.Object, response.RootElement.GetProperty("primaryMetric").ValueKind);
        Assert.Equal(JsonValueKind.Array, response.RootElement.GetProperty("guardrailMetrics").ValueKind);
        Assert.False(response.RootElement.TryGetProperty("guardrails", out _));
        foreach (var runResponse in response.RootElement.GetProperty("experimentRuns").EnumerateArray())
        {
            Assert.Equal(JsonValueKind.Array, runResponse.GetProperty("guardrailMetrics").ValueKind);
            Assert.False(runResponse.TryGetProperty("guardrails", out _));
        }
    }

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task MissingRunSnapshot_IsNeverFilledFromExperimentDuringReadOrAnalysis(string provider)
    {
        var envId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var flag = new FeatureFlag(envId, "Checkout", "", "checkout", true, "boolean",
            [new Variation { Id = "control", Name = "Control", Value = "false" },
             new Variation { Id = "treatment", Name = "Treatment", Value = "true" }],
            "control", "treatment", [], Guid.NewGuid());
        await fixture.CreateFeatureFlagService(provider).AddOneAsync(flag);
        var experiment = new Experiment
        {
            Id = Guid.NewGuid(), EnvId = envId, FlagId = flag.Id, Name = "Missing snapshot",
            PrimaryMetric = new PrimaryMetricConfig { MetricId = Guid.NewGuid(), MetricKey = "purchase", EventName = "purchase" },
            GuardrailMetrics = [new GuardrailMetricConfig { MetricId = Guid.NewGuid(), MetricKey = "errors", EventName = "errors" }],
            CreatedAt = now, UpdatedAt = now
        };
        await fixture.CreateExperimentServices(provider).ExperimentService.CreateAsync(experiment);
        var run = new ExperimentRun
        {
            Id = Guid.NewGuid(), ExperimentId = experiment.Id, Slug = "imported-run", Method = "bayesian_ab",
            ObservationStart = now, CreatedAt = now, UpdatedAt = now
        };
        if (provider == "Postgres")
        {
            await using var db = fixture.CreateDbContext();
            db.Set<ExperimentRun>().Add(run);
            await db.SaveChangesAsync();
        }
        else
        {
            await fixture.CreateMongoDbClient().CollectionOf<ExperimentRun>().InsertOneAsync(run);
        }
        var service = fixture.CreateExperimentServices(provider).ExperimentService;
        var read = Assert.Single((await service.GetAsync(envId, experiment.Id)).ExperimentRuns);
        Assert.Null(read.PrimaryMetric);
        Assert.Empty(read.GuardrailMetrics);
        var error = await Assert.ThrowsAsync<BusinessException>(() =>
            service.AnalyzeRunAsync(envId, experiment.Id, run.Id, new ExperimentRunAnalyzeRequest()));
        Assert.Equal(ErrorCodes.Required("primaryMetric"), error.Message);
        Assert.Null(Assert.Single((await fixture.CreateExperimentServices(provider).ExperimentService.GetAsync(envId, experiment.Id)).ExperimentRuns).PrimaryMetric);
    }

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task CreateRun_RequiresPrimaryMetricConfiguration(string provider)
    {
        var envId = Guid.NewGuid();
        var service = fixture.CreateExperimentServices(provider).ExperimentService;
        var experiment = await service.CreateAsync(new Experiment
        {
            Id = Guid.NewGuid(), EnvId = envId, Name = "No metrics", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        });
        var error = await Assert.ThrowsAsync<BusinessException>(() => service.CreateRunAsync(envId, experiment.Id));
        Assert.Equal(ErrorCodes.Required("primaryMetric"), error.Message);
        Assert.Empty((await service.GetAsync(envId, experiment.Id)).ExperimentRuns);
    }

    private async Task<(Guid EnvId, Guid ExperimentId, ExperimentRunVm Run, ExperimentMetric Primary, ExperimentMetric Guardrail)>
        CreateConfiguredRunAsync(string provider)
    {
        var envId = Guid.NewGuid();
        var start = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        var flag = new FeatureFlag(envId, "Checkout", "", "checkout-flow", true, "boolean",
            [new Variation { Id = "control", Name = "Control", Value = "false" },
             new Variation { Id = "treatment", Name = "Treatment", Value = "true" }],
            "control", "treatment", [], Guid.NewGuid());
        await fixture.CreateFeatureFlagService(provider).AddOneAsync(flag);
        var (experiments, metrics) = fixture.CreateExperimentServices(provider);
        var primary = await metrics.CreateAsync(envId, new CreateExperimentMetricRequest
        {
            Name = "Purchase conversion", Key = "purchase_conversion", EventName = " purchase ",
            MetricType = "binary", MetricAgg = "once"
        });
        var guardrail = await metrics.CreateAsync(envId, new CreateExperimentMetricRequest
        {
            Name = "Purchase amount", Key = "purchase_amount", EventName = "purchase",
            MetricType = "numeric", MetricAgg = "sum"
        });
        var experiment = await experiments.CreateAsync(new Experiment
        {
            Id = Guid.NewGuid(), EnvId = envId, FlagId = flag.Id, Name = "Shared purchase event",
            CreatedAt = start, UpdatedAt = start
        });
        await experiments.UpdateMetricsAsync(envId, experiment.Id, new ExperimentMetricsUpdate
        {
            PrimaryMetric = new PrimaryMetricSelection { MetricId = primary.Id, ExpectedDirection = "increase_good" },
            GuardrailMetrics = [new GuardrailMetricSelection { MetricId = guardrail.Id, Direction = "decrease_bad" }]
        });
        var run = Assert.Single((await experiments.CreateRunAsync(envId, experiment.Id)).ExperimentRuns);
        var configured = await experiments.UpdateRunAsync(envId, experiment.Id, run.Id, new ExperimentRunUpdate
        {
            Method = "bayesian_ab", ControlVariant = "control", TreatmentVariants = ["treatment"],
            ObservationStart = start, ObservationEnd = start.AddHours(1)
        });

        return (envId, experiment.Id, Assert.Single(configured.ExperimentRuns), primary, guardrail);
    }

    private async Task SeedInsightsAsync(string provider, Guid envId, DateTime start)
    {
        var insights = new List<object>();
        foreach (var treatment in new[] { false, true })
        {
            for (var index = 0; index < 10; index++)
            {
                var userKey = $"{treatment}-{index}";
                insights.Add(new ExperimentExposureEvent
                {
                    Id = Guid.NewGuid(), EnvId = envId, FlagKey = "checkout-flow", UserKey = userKey,
                    VariationId = treatment ? "treatment" : "control", VariationValue = treatment ? "true" : "false",
                    ExposedAt = start.AddMinutes(1), CreatedAt = start
                });
                if (index < (treatment ? 8 : 5))
                {
                    insights.Add(new ExperimentMetricEvent
                    {
                        Id = Guid.NewGuid(), EnvId = envId, UserKey = userKey, EventName = "purchase",
                        EventType = "CustomEvent", NumericValue = treatment ? 20 : 10,
                        OccurredAt = start.AddMinutes(2), CreatedAt = start
                    });
                }
            }
        }
        await fixture.CreateInsightsService(provider).AddManyAsync(insights.ToArray());
    }

    private async Task<ExperimentDetailVm> ChangeMetricDefaultsAsync(
        string provider, Guid envId, Guid experimentId, Guid primaryId, Guid guardrailId)
    {
        var metrics = fixture.CreateExperimentMetricService(provider);
        await metrics.UpdateAsync(envId, primaryId, new UpdateExperimentMetricRequest
        {
            Name = "Changed name", EventName = "purchase_v2", Description = "Changed description",
            MetricType = "numeric", MetricAgg = "average"
        });
        await metrics.UpdateAsync(envId, guardrailId, new UpdateExperimentMetricRequest
        {
            Name = "Changed guardrail", EventName = "purchase_error", MetricType = "binary", MetricAgg = "once"
        });
        return await fixture.CreateExperimentServices(provider).ExperimentService.UpdateMetricsAsync(envId, experimentId,
            new ExperimentMetricsUpdate
            {
                PrimaryMetric = new PrimaryMetricSelection { MetricId = primaryId, ExpectedDirection = "decrease_good" },
                GuardrailMetrics = [new GuardrailMetricSelection { MetricId = guardrailId, Direction = "increase_bad" }]
            });
    }
}
