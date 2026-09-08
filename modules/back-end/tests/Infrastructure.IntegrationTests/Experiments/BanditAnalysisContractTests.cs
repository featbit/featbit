using System.Text.Json;
using Application.Experiments;
using Application.ExperimentStats;
using Application.Services;
using Domain.Experiments;
using Moq;

namespace Infrastructure.IntegrationTests.Experiments;

[Collection(nameof(ExperimentProviderParityCollection))]
public sealed class PostgresBanditAnalysisContractTests(ExperimentProviderParityFixture fixture)
    : BanditAnalysisContractTests(fixture, "Postgres");

[Collection(nameof(ExperimentProviderParityCollection))]
public sealed class MongoDbBanditAnalysisContractTests(ExperimentProviderParityFixture fixture)
    : BanditAnalysisContractTests(fixture, "MongoDb");

public abstract class BanditAnalysisContractTests(ExperimentProviderParityFixture fixture, string provider)
    : IntegrationTestBase
{
    private static readonly string[] Arms = ["control", "arm-1", "arm-2", "arm-3"];
    private static readonly (string Event, string Type, string Agg)[] Metrics =
    [
        ("conversion", "binary", "once"),
        ("engagement", "numeric", "count"),
        ("revenue", "numeric", "sum"),
        ("latency", "numeric", "average")
    ];

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task EmptyQuery_PreservesTypesWhenPrimaryAndGuardrailSwap(bool swapped)
    {
        using var result = await Analyze("bandit", swapped, users: 0, emptyQuery: true);
        var root = result.RootElement;
        Assert.Equal(swapped ? "numeric" : "proportion", root.GetProperty("metric_type").GetString());
        Assert.Equal(swapped ? "count" : "once", root.GetProperty("metric_agg").GetString());
        AssertGuardrailTypes(root, users: 0);
        AssertUnavailableRecommendations(root);
    }

    [DockerTheory]
    [InlineData(0)]
    [InlineData(99)]
    [InlineData(100)]
    public async Task BurnIn_UsesActualThresholdAndNoProbabilityPlaceholders(int users)
    {
        using var result = await Analyze("bandit", swapped: true, users);
        var root = result.RootElement;
        AssertGuardrailTypes(root, users);
        var thompson = root.GetProperty("thompson_sampling");
        Assert.Equal(100, thompson.GetProperty("minimum_units_per_arm").GetInt32());
        Assert.Equal(users >= 100, thompson.GetProperty("enough_units").GetBoolean());
        if (users < 100)
        {
            AssertUnavailableRecommendations(root);
        }
        else
        {
            var recommendations = thompson.GetProperty("results").EnumerateArray().ToArray();
            Assert.Equal(1, recommendations.Sum(x => x.GetProperty("p_best").GetDouble()), 6);
            Assert.Equal(1, recommendations.Sum(x => x.GetProperty("recommended_weight").GetDouble()), 6);
        }
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task GuardrailComparison_MatchesUnchangedBayesianResults(bool swapped)
    {
        using var bandit = await Analyze("bandit", swapped, users: 500);
        using var bayesian = await Analyze("bayesian_ab", swapped, users: 500);
        Assert.Equal("bayesian", bayesian.RootElement.GetProperty("type").GetString());
        Assert.False(bayesian.RootElement.TryGetProperty("thompson_sampling", out _));
        Assert.False(bayesian.RootElement.TryGetProperty("stopping", out _));
        Assert.Equal(
            bayesian.RootElement.GetProperty("guardrails").GetRawText(),
            bandit.RootElement.GetProperty("guardrails").GetRawText());
        AssertGuardrailTypes(bandit.RootElement, users: 500);
    }

    [DockerTheory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task ConstantObservations_KeepObservedMeanInBanditPosterior(bool numeric, bool inverse)
    {
        using var result = await Analyze("bandit", swapped: numeric, users: 200,
            constantValues: true, inverse: inverse);
        var expected = inverse ? "arm-3" : "control";
        var winner = result.RootElement.GetProperty("thompson_sampling")
            .GetProperty("results").EnumerateArray().Single(x => x.GetProperty("arm").GetString() == expected);
        Assert.True(winner.GetProperty("p_best").GetDouble() > 0.99);
    }

    private static void AssertUnavailableRecommendations(JsonElement root)
    {
        var thompson = root.GetProperty("thompson_sampling");
        Assert.False(thompson.GetProperty("enough_units").GetBoolean());
        Assert.All(thompson.GetProperty("results").EnumerateArray(), row =>
        {
            Assert.Equal(JsonValueKind.Null, row.GetProperty("p_best").ValueKind);
            Assert.Equal(JsonValueKind.Null, row.GetProperty("recommended_weight").ValueKind);
        });
        Assert.False(root.GetProperty("stopping").GetProperty("met").GetBoolean());
        Assert.Equal(JsonValueKind.Null, root.GetProperty("stopping").GetProperty("best_arm").ValueKind);
    }

    private static void AssertGuardrailTypes(JsonElement root, int users)
    {
        foreach (var guardrail in root.GetProperty("guardrails").EnumerateArray())
        {
            var metric = Metrics.Single(x => x.Event == guardrail.GetProperty("event").GetString());
            var binary = metric.Type == "binary";
            Assert.Equal(binary ? "proportion" : "numeric", guardrail.GetProperty("metric_type").GetString());
            Assert.Equal(metric.Agg, guardrail.GetProperty("metric_agg").GetString());
            Assert.All(guardrail.GetProperty("rows").EnumerateArray(), row =>
            {
                Assert.Equal(users, row.GetProperty("n").GetInt64());
                Assert.Equal(binary, row.TryGetProperty("conversions", out _));
                Assert.Equal(binary, row.TryGetProperty("rate", out _));
                Assert.Equal(!binary, row.TryGetProperty("mean", out _));
                if (users == 0) Assert.False(row.TryGetProperty("p_harm", out _));
            });
        }
    }

    private async Task<JsonDocument> Analyze(
        string method, bool swapped, int users, bool emptyQuery = false,
        bool constantValues = false, bool inverse = false)
    {
        var stats = new Mock<IExperimentStatsService>();
        stats.Setup(x => x.QueryAsync(It.IsAny<QueryExperimentStats>()))
            .ReturnsAsync((QueryExperimentStats query) => new ExperimentStatsVm
            {
                Variants = emptyQuery ? [] : Arms.Select((arm, index) =>
                {
                    var mean = constantValues ? 4 - index : 3 + index;
                    var conversions = constantValues ? (index == 0 ? users : index == 3 ? 0 : users / 2) : users * (index + 1) / 5;
                    return new ExperimentVariantStatsVm
                    {
                        Variant = arm, Users = users, Conversions = conversions,
                        SumValue = users * mean,
                        SumSquares = users * (mean * mean + (constantValues ? 0 : 2))
                    };
                }).ToArray()
            });
        var flags = new Mock<IFeatureFlagService>();
        var service = fixture.CreateExperimentServices(provider, stats.Object, flags.Object).ExperimentService;
        var primary = Metrics[swapped ? 1 : 0];
        var experiment = new Experiment
        {
            Id = Guid.NewGuid(), Name = "Bandit result contract", Stage = "measuring",
            FeatBitEnvId = ExperimentProviderParityFixture.EnvId, FlagKey = "bandit-contract",
            PrimaryMetric = JsonSerializer.Serialize(new
            {
                @event = primary.Event, metricType = primary.Type, metricAgg = primary.Agg,
                expectedDirection = inverse ? "decrease_good" : "increase_good"
            }),
            Guardrails = JsonSerializer.Serialize(Metrics.Where(x => x.Event != primary.Event).Select(x => new
            {
                @event = x.Event, metricType = x.Type, metricAgg = x.Agg,
                inverse = x.Event == "latency",
                direction = x.Event == "latency" ? "increase_bad" : "decrease_bad"
            }))
        };
        var envId = ExperimentProviderParityFixture.EnvId;
        await service.CreateAsync(experiment);
        var created = await service.CreateRunAsync(envId, experiment.Id);
        var run = Assert.Single(created.ExperimentRuns);
        await service.UpdateRunAsync(envId, experiment.Id, run.Id, new ExperimentRunUpdate
        {
            Method = method, ControlVariant = Arms[0], TreatmentVariant = string.Join("|", Arms.Skip(1)),
            ObservationStart = DateTime.UtcNow.AddDays(-1), ObservationEnd = null
        });
        var analyzed = await service.AnalyzeRunAsync(envId, experiment.Id, run.Id, new ExperimentRunAnalyzeRequest());
        return JsonDocument.Parse(Assert.Single(analyzed.ExperimentRuns).AnalysisResult);
    }
}
