using Application.ExperimentStats;
using Application.FeatureFlags;
using Application.Experiments;
using Application.Services;
using Domain.Experiments;
using System.Text.Json;
using Application.EndUsers;
using Application.Insights;

namespace Infrastructure.IntegrationTests.Experiments;

public abstract class ExperimentProviderTestsBase(ExperimentProviderParityFixture fixture) : IntegrationTestBase
{
    protected abstract string ProviderName { get; }

    private IExperimentStatsService CreateExperimentStatsService() =>
        fixture.CreateExperimentStatsService(ProviderName);

    private IInsightService CreateInsightsService() =>
        fixture.CreateInsightsService(ProviderName);

    private IEndUserStatsService CreateEndUserStatsService() =>
        fixture.CreateEndUserStatsService(ProviderName);

    private IExperimentMetricService CreateExperimentMetricService() =>
        fixture.CreateExperimentMetricService(ProviderName);

    private (IExperimentService ExperimentService, IExperimentMetricService MetricService)
        CreateExperimentServices() => fixture.CreateExperimentServices(ProviderName);

    private const string TenTenSamplingPlan = """
        [
          { "variation": "control", "role": "control", "includeRate": 11.111111 },
          { "variation": "treatment", "role": "treatment", "includeRate": 100 }
        ]
        """;

    [DockerTheory]
    [InlineData("binary", "once")]
    [InlineData("continuous", "count")]
    [InlineData("continuous", "sum")]
    [InlineData("continuous", "average")]
    public async Task QueryExperimentStats_ValidMetric_ReturnsExpectedResults(string metricType, string metricAgg)
    {
        await fixture.SeedScenarioAsync(ProviderName);

        var request = new QueryExperimentStats
        {
            EnvId = ExperimentProviderParityFixture.StandardEnvId,
            FlagKey = ExperimentProviderParityFixture.FlagKey,
            MetricEvent = ExperimentProviderParityFixture.MetricEvent,
            StartDate = "2026-01-01",
            EndDate = "2026-01-02",
            MetricType = metricType,
            MetricAgg = metricAgg
        };

        var actual = Normalize(await CreateExperimentStatsService().QueryAsync(request));

        AssertStatsEqual("expected fixture", ExpectedStats(metricType, metricAgg), ProviderName, actual);
    }

    [DockerFact]
    public async Task QueryExperimentStats_TrafficScope_ReturnsConsistentResults()
    {
        await fixture.SeedScenarioAsync(ProviderName);

        var request = new QueryExperimentStats
        {
            EnvId = ExperimentProviderParityFixture.StandardEnvId,
            FlagKey = ExperimentProviderParityFixture.FlagKey,
            MetricEvent = ExperimentProviderParityFixture.MetricEvent,
            StartDate = "2026-01-01",
            EndDate = "2026-01-02",
            MetricType = "binary",
            MetricAgg = "once",
            TrafficPercent = 20,
            TrafficOffset = 0,
            LayerId = "checkout-layer"
        };

        var actual = Normalize(await CreateExperimentStatsService().QueryAsync(request));
        var scopedUsers = actual.Variants.Sum(x => x.Users);
        Assert.InRange(scopedUsers, 1, 1_499);
    }

    [DockerFact]
    public async Task QueryExperimentStats_RunTrafficScope_MatchesVariantCohorts()
    {
        await fixture.SeedUnbalancedVariantScenarioAsync(ProviderName);

        var request = new QueryExperimentStats
        {
            EnvId = ExperimentProviderParityFixture.UnbalancedEnvId,
            FlagKey = ExperimentProviderParityFixture.FlagKey,
            MetricEvent = ExperimentProviderParityFixture.MetricEvent,
            StartDate = "2026-01-01",
            EndDate = "2026-01-02",
            MetricType = "binary",
            MetricAgg = "once",
            TrafficPercent = 20,
            TrafficOffset = 0,
            ControlVariant = "control",
            TreatmentVariants = "treatment"
        };

        var actual = Normalize(await CreateExperimentStatsService().QueryAsync(request));
        Assert.Equal(
            [("control", 100L), ("treatment", 100L)],
            actual.Variants.Select(x => (x.Variant, x.Users)).ToArray());
    }

    [DockerFact]
    public async Task QueryExperimentStats_RunSamplingPlan_UsesAnalysisArms()
    {
        var runId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        await fixture.SeedSamplingPlanScenarioAsync(ProviderName);

        var request = new QueryExperimentStats
        {
            RunId = runId,
            EnvId = ExperimentProviderParityFixture.SamplingEnvId,
            FlagKey = ExperimentProviderParityFixture.FlagKey,
            MetricEvent = ExperimentProviderParityFixture.MetricEvent,
            StartDate = "2026-01-01",
            EndDate = "2026-01-02",
            MetricType = "binary",
            MetricAgg = "once",
            AssignmentUnitSelector = "user.keyId",
            LayerTrafficPercent = 100,
            AnalysisSamplingPlan = TenTenSamplingPlan
        };

        var actual = Normalize(await CreateExperimentStatsService().QueryAsync(request));
        Assert.Equal(
            [("control", 80L), ("treatment", 80L)],
            actual.Variants.Select(x => (x.Variant, x.Users)).ToArray());
        Assert.Equal(
            [("control", 80L), ("treatment", 80L)],
            actual.Variants.Select(x => (x.Variant, x.Conversions)).ToArray());
    }

    [DockerFact]
    public async Task QueryExperimentStats_GuardrailEvents_UsesRunSamplingPlan()
    {
        var runId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        await fixture.SeedSamplingPlanScenarioAsync(ProviderName);

        var request = new QueryExperimentStats
        {
            RunId = runId,
            EnvId = ExperimentProviderParityFixture.SamplingEnvId,
            FlagKey = ExperimentProviderParityFixture.FlagKey,
            MetricEvent = ExperimentProviderParityFixture.GuardrailEvent,
            StartDate = "2026-01-01",
            EndDate = "2026-01-02",
            MetricType = "binary",
            MetricAgg = "once",
            AssignmentUnitSelector = "user.keyId",
            LayerTrafficPercent = 100,
            AnalysisSamplingPlan = TenTenSamplingPlan
        };

        var actual = Normalize(await CreateExperimentStatsService().QueryAsync(request));
        Assert.Equal(
            [("control", 80L), ("treatment", 80L)],
            actual.Variants.Select(x => (x.Variant, x.Users)).ToArray());
        Assert.Equal(
            [("control", 80L), ("treatment", 80L)],
            actual.Variants.Select(x => (x.Variant, x.Conversions)).ToArray());
    }

    [DockerFact]
    public async Task QueryExperimentStats_LayeredExperiment_AppliesEligibilityBeforeSampling()
    {
        var runId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        await fixture.SeedSamplingPlanScenarioAsync(ProviderName);

        var request = new QueryExperimentStats
        {
            RunId = runId,
            EnvId = ExperimentProviderParityFixture.SamplingEnvId,
            FlagKey = ExperimentProviderParityFixture.FlagKey,
            MetricEvent = ExperimentProviderParityFixture.MetricEvent,
            StartDate = "2026-01-01",
            EndDate = "2026-01-02",
            MetricType = "binary",
            MetricAgg = "once",
            AssignmentUnitSelector = "user.keyId",
            LayerKey = "checkout-mutual-exclusion-layer",
            LayerTrafficPercent = 40,
            AnalysisSamplingPlan = TenTenSamplingPlan
        };

        var actual = Normalize(await CreateExperimentStatsService().QueryAsync(request));
        var totalUsers = actual.Variants.Sum(x => x.Users);
        Assert.InRange(totalUsers, 1, 159);
    }

    [DockerFact]
    public async Task QueryExperimentStats_MissingCustomAssignmentSelector_ExcludesSamplingEvents()
    {
        var runId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        await fixture.SeedSamplingPlanScenarioAsync(ProviderName);

        var request = new QueryExperimentStats
        {
            RunId = runId,
            EnvId = ExperimentProviderParityFixture.SamplingEnvId,
            FlagKey = ExperimentProviderParityFixture.FlagKey,
            MetricEvent = ExperimentProviderParityFixture.MetricEvent,
            StartDate = "2026-01-01",
            EndDate = "2026-01-02",
            MetricType = "binary",
            MetricAgg = "once",
            AssignmentUnitSelector = "accountId",
            LayerTrafficPercent = 100,
            AnalysisSamplingPlan = TenTenSamplingPlan
        };

        var actual = Normalize(await CreateExperimentStatsService().QueryAsync(request));

        Assert.Empty(actual.Variants);
    }

    [DockerFact]
    public async Task GetInsights_SeededScenario_ReturnsExpectedBuckets()
    {
        await fixture.SeedScenarioAsync(ProviderName);

        var filter = new InsightFilter
        {
            FeatureFlagKey = ExperimentProviderParityFixture.FlagKey,
            IntervalType = IntervalType.Day,
            From = DateTimeOffset.Parse("2026-01-01T00:00:00Z").ToUnixTimeMilliseconds(),
            To = DateTimeOffset.Parse("2026-01-02T23:59:59Z").ToUnixTimeMilliseconds()
        };

        var actual = Normalize(await CreateInsightsService()
            .GetInsightsAsync(ExperimentProviderParityFixture.EnvId, filter));

        AssertInsightsEqual("expected fixture", ExpectedInsights(), ProviderName, actual);
    }

    [DockerFact]
    public async Task GetFeatureFlagEndUserStats_SeededScenario_ReturnsExpectedResults()
    {
        await fixture.SeedScenarioAsync(ProviderName);

        var param = new EndUserStatsFilter
        {
            FeatureFlagKey = ExperimentProviderParityFixture.FlagKey,
            From = DateTimeOffset.Parse("2026-01-01T00:00:00Z").ToUnixTimeMilliseconds(),
            To = DateTimeOffset.Parse("2026-01-02T23:59:59Z").ToUnixTimeMilliseconds(),
            PageIndex = 0,
            PageSize = 20
        };

        var actual = Normalize(await CreateEndUserStatsService()
            .GetEndUserStatsAsync(ExperimentProviderParityFixture.StandardEnvId, param));

        Assert.Equal(1_500, actual.TotalCount);
        Assert.Equal(20, actual.Items.Count);
    }

    protected async Task UpdateExperimentMetric_PersistsChanges()
    {
        var service = CreateExperimentMetricService();
        var key = $"metric-update-{Guid.NewGuid():N}";
        var created = await service.CreateAsync(ExperimentProviderParityFixture.EnvId, new ExperimentMetricUpdate
        {
            Name = "Metric update parity",
            Key = key,
            MetricType = "binary",
            MetricAgg = "once",
            Status = "active"
        });

        await service.UpdateAsync(ExperimentProviderParityFixture.EnvId, created.Id, new ExperimentMetricUpdate
        {
            Name = "Metric update parity",
            Key = key,
            MetricType = "continuous",
            MetricAgg = "sum",
            Status = "active"
        });

        var listed = await service.GetListAsync(ExperimentProviderParityFixture.EnvId, new ExperimentMetricFilter
        {
            Key = key,
            PageIndex = 0,
            PageSize = 10
        });
        var metric = Assert.Single(listed.Items);
        Assert.Equal("continuous", metric.MetricType);
        Assert.Equal("sum", metric.MetricAgg);
        Assert.Equal("active", metric.Status);
    }

    protected async Task VerifySharedMetricPersistsForMultipleExperiments()
    {
        var (experimentService, metricService) = CreateExperimentServices();
        var key = $"metric-reuse-{Guid.NewGuid():N}";
        var metric = await metricService.CreateAsync(ExperimentProviderParityFixture.EnvId, new ExperimentMetricUpdate
        {
            Name = "Metric reuse parity",
            Key = key,
            Description = "One registered metric can be selected by multiple experiments.",
            MetricType = "binary",
            MetricAgg = "once",
            Status = "active"
        });

        var firstExperiment = NewExperiment("Metric reuse first");
        var secondExperiment = NewExperiment("Metric reuse second");
        await experimentService.CreateAsync(firstExperiment);
        await experimentService.CreateAsync(secondExperiment);

        var first = await experimentService.UpdateMetricsAsync(
            ExperimentProviderParityFixture.EnvId,
            firstExperiment.Id,
            new ExperimentMetricsUpdate
            {
                MetricId = metric.Id,
                ExpectedDirection = "increase_good",
                Guardrails = "[]"
            });
        var second = await experimentService.UpdateMetricsAsync(
            ExperimentProviderParityFixture.EnvId,
            secondExperiment.Id,
            new ExperimentMetricsUpdate
            {
                MetricId = metric.Id,
                ExpectedDirection = "decrease_good",
                Guardrails = "[]"
            });

        AssertPrimaryMetric(ProviderName, first, metric.Id, key, "increase_good");
        AssertPrimaryMetric(ProviderName, second, metric.Id, key, "decrease_good");
    }

    private static Experiment NewExperiment(string name)
    {
        var now = DateTime.UtcNow;
        return new Experiment
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = "Provider parity experiment",
            Stage = "hypothesis",
            FeatBitProjectKey = "provider-parity",
            FeatBitEnvId = ExperimentProviderParityFixture.EnvId,
            SandboxStatus = "idle",
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static void AssertPrimaryMetric(
        string provider,
        ExperimentDetailVm experiment,
        Guid metricId,
        string metricKey,
        string expectedDirection)
    {
        using var doc = JsonDocument.Parse(experiment.PrimaryMetric);
        var root = doc.RootElement;

        Assert.NotEqual(Guid.Empty, metricId);
        Assert.Equal(metricKey, root.GetProperty("event").GetString());
        Assert.Equal(expectedDirection, root.GetProperty("expectedDirection").GetString());
        Assert.Equal("binary", root.GetProperty("metricType").GetString());
        Assert.Equal("once", root.GetProperty("metricAgg").GetString());
        Assert.True(
            root.GetProperty("description").GetString()?.Contains("multiple experiments") == true,
            $"{provider} should preserve the selected catalog metric description.");
    }

    private static NormalizedStats ExpectedStats(string metricType, string metricAgg)
    {
        IReadOnlyList<NormalizedVariantStats> variants = (metricType, metricAgg) switch
        {
            ("binary", "once") =>
            [
                Variant("A", conversions: 250, sumValue: 250, sumSquares: 250),
                Variant("B", conversions: 300, sumValue: 300, sumSquares: 300),
                Variant("C", conversions: 200, sumValue: 200, sumSquares: 200)
            ],
            ("continuous", "count") =>
            [
                Variant("A", conversions: 250, sumValue: 500, sumSquares: 1_000),
                Variant("B", conversions: 300, sumValue: 300, sumSquares: 300),
                Variant("C", conversions: 200, sumValue: 600, sumSquares: 1_800)
            ],
            ("continuous", "sum") =>
            [
                Variant("A", conversions: 250, sumValue: 7_500, sumSquares: 225_000),
                Variant("B", conversions: 300, sumValue: 7_500, sumSquares: 187_500),
                Variant("C", conversions: 200, sumValue: 1_200, sumSquares: 7_200)
            ],
            ("continuous", "average") =>
            [
                Variant("A", conversions: 250, sumValue: 3_750, sumSquares: 56_250),
                Variant("B", conversions: 300, sumValue: 7_500, sumSquares: 187_500),
                Variant("C", conversions: 200, sumValue: 400, sumSquares: 800)
            ],
            _ => throw new ArgumentException($"Unsupported metric case: {metricType}/{metricAgg}")
        };

        return new NormalizedStats(
            ExperimentProviderParityFixture.EnvId,
            ExperimentProviderParityFixture.FlagKey,
            ExperimentProviderParityFixture.MetricEvent,
            "2026-01-01",
            "2026-01-02",
            variants);
    }

    private static IReadOnlyList<NormalizedInsight> ExpectedInsights()
    {
        return
        [
            new NormalizedInsight(
                DateTime.SpecifyKind(new DateTime(2026, 1, 1), DateTimeKind.Utc),
                [
                    new NormalizedVariationInsight("A", 250),
                    new NormalizedVariationInsight("B", 250),
                    new NormalizedVariationInsight("C", 250)
                ]),
            new NormalizedInsight(
                DateTime.SpecifyKind(new DateTime(2026, 1, 2), DateTimeKind.Utc),
                [
                    new NormalizedVariationInsight("A", 250),
                    new NormalizedVariationInsight("B", 250),
                    new NormalizedVariationInsight("C", 250)
                ])
        ];
    }

    private static NormalizedVariantStats Variant(
        string variant,
        long conversions,
        double sumValue,
        double sumSquares)
    {
        const long users = 500;

        return new NormalizedVariantStats(
            variant,
            users,
            conversions,
            sumValue,
            sumSquares,
            Round((double)conversions / users),
            Round(sumValue / users));
    }

    private static NormalizedStats Normalize(ExperimentStatsVm stats)
    {
        return new NormalizedStats(
            stats.EnvId,
            stats.FlagKey,
            stats.MetricEvent,
            stats.Window.Start,
            stats.Window.End,
            stats.Variants
                .OrderBy(x => x.Variant)
                .Select(x => new NormalizedVariantStats(
                    x.Variant,
                    x.Users,
                    x.Conversions,
                    Round(x.SumValue),
                    Round(x.SumSquares),
                    Round(x.ConversionRate),
                    Round(x.AvgValue)
                ))
                .ToArray()
        );
    }

    private static IReadOnlyList<NormalizedInsight> Normalize(ICollection<Insight> insights)
    {
        return insights
            .OrderBy(x => DateTimeOffset.Parse(x.Time).UtcDateTime)
            .Select(x => new NormalizedInsight(
                DateTimeOffset.Parse(x.Time).UtcDateTime,
                x.Variations
                    .OrderBy(v => v.Id)
                    .Select(v => new NormalizedVariationInsight(v.Id, v.Val))
                    .ToArray()
            ))
            .ToArray();
    }

    private static NormalizedEndUserStats Normalize(EndUserStats stats)
    {
        return new NormalizedEndUserStats(
            stats.TotalCount,
            stats.Items
                .OrderByDescending(x => DateTimeOffset.Parse(x.LastEvaluatedAt).UtcDateTime)
                .ThenBy(x => x.KeyId)
                .ThenBy(x => x.VariationId)
                .Select(x => new NormalizedEndUser(
                    x.VariationId,
                    x.KeyId,
                    x.Name,
                    DateTimeOffset.Parse(x.LastEvaluatedAt).UtcDateTime
                ))
                .ToArray()
        );
    }

    private static void AssertStatsEqual(
        string expectedProvider,
        NormalizedStats expected,
        string actualProvider,
        NormalizedStats actual)
    {
        Assert.Equal(expected.EnvId, actual.EnvId);
        Assert.Equal(expected.FlagKey, actual.FlagKey);
        Assert.Equal(expected.MetricEvent, actual.MetricEvent);
        Assert.Equal(expected.WindowStart, actual.WindowStart);
        Assert.Equal(expected.WindowEnd, actual.WindowEnd);
        Assert.True(
            expected.Variants.SequenceEqual(actual.Variants),
            $"{expectedProvider} and {actualProvider} should return the same variant stats.");
    }

    private static void AssertInsightsEqual(
        string expectedProvider,
        IReadOnlyList<NormalizedInsight> expected,
        string actualProvider,
        IReadOnlyList<NormalizedInsight> actual)
    {
        Assert.True(
            expected.Count == actual.Count,
            $"{expectedProvider} and {actualProvider} should return the same insight bucket count. " +
            $"Expected {expected.Count}, actual {actual.Count}.");

        for (var i = 0; i < expected.Count; i++)
        {
            Assert.Equal(expected[i].Bucket, actual[i].Bucket);
            Assert.True(
                expected[i].Variations.SequenceEqual(actual[i].Variations),
                $"{expectedProvider} and {actualProvider} should return the same variations for bucket {expected[i].Bucket:O}.");
        }
    }

    private static double Round(double value)
    {
        return Math.Round(value, 9, MidpointRounding.AwayFromZero);
    }

    private sealed record NormalizedStats(
        Guid EnvId,
        string FlagKey,
        string MetricEvent,
        string WindowStart,
        string WindowEnd,
        IReadOnlyList<NormalizedVariantStats> Variants);

    private sealed record NormalizedVariantStats(
        string Variant,
        long Users,
        long Conversions,
        double SumValue,
        double SumSquares,
        double ConversionRate,
        double AvgValue);

    private sealed record NormalizedInsight(
        DateTime Bucket,
        IReadOnlyList<NormalizedVariationInsight> Variations);

    private sealed record NormalizedVariationInsight(string VariationId, int Count);

    private sealed record NormalizedEndUserStats(
        int TotalCount,
        IReadOnlyList<NormalizedEndUser> Items);

    private sealed record NormalizedEndUser(
        string VariationId,
        string KeyId,
        string Name,
        DateTime LastEvaluatedAt);
}

public abstract class WritableExperimentProviderTestsBase(
    ExperimentProviderParityFixture fixture) : ExperimentProviderTestsBase(fixture)
{
    [DockerFact]
    public Task UpdateExperimentMetric_ValidUpdate_PersistsChanges() =>
        UpdateExperimentMetric_PersistsChanges();

    [DockerFact]
    public Task UpdateExperimentMetric_SharedMetric_PersistsForMultipleExperiments() =>
        VerifySharedMetricPersistsForMultipleExperiments();
}
