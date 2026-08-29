using System.Linq.Expressions;
using System.Text.Json;
using Application.ExperimentStats;
using Application.Experiments;
using Application.Services;
using Application.Users;
using Domain.FeatureFlags;
using Domain.Experiments;
using Domain.Users;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Services.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace Infrastructure.IntegrationTests.Experiments;

[Collection(nameof(ExperimentProviderParityCollection))]
public class ExperimentAnalysisAlgorithmTests : IntegrationTestBase
{
    private readonly ExperimentProviderParityFixture _fixture;

    public ExperimentAnalysisAlgorithmTests(ExperimentProviderParityFixture fixture)
    {
        _fixture = fixture;
    }

    private static readonly Guid EnvId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid ExperimentId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid RunId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid UserId = Guid.Parse("55555555-5555-5555-5555-555555555555");

    [DockerFact]
    public async Task AnalyzeRun_BayesianBinary_ReportsConversionRateAndWinProbability()
    {
        var stats = new FixedExperimentStatsService(new ExperimentStatsVm
        {
            EnvId = EnvId,
            FlagKey = "checkout-flow",
            MetricEvent = "purchase",
            Window = new ExperimentStatsWindowVm { Start = "2026-01-01", End = "2026-01-02" },
            Variants =
            [
                Variant("control", users: 200, conversions: 80, sumValue: 80, sumSquares: 80),
                Variant("treatment", users: 200, conversions: 100, sumValue: 100, sumSquares: 100)
            ]
        });
        await using var db = CreateDbContext();
        await SeedExperimentAsync(db, method: "bayesian_ab", metricType: "binary", metricAgg: "once");

        var result = await CreateService(db, stats).AnalyzeRunAsync(
            EnvId,
            ExperimentId,
            RunId,
            new ExperimentRunAnalyzeRequest());

        using var document = JsonDocument.Parse(result.ExperimentRuns.Single().AnalysisResult);
        var root = document.RootElement;
        var primary = root.GetProperty("primary_metric");
        var rows = primary.GetProperty("rows").EnumerateArray().ToArray();
        var control = rows.Single(x => x.GetProperty("variant").GetString() == "control");
        var treatment = rows.Single(x => x.GetProperty("variant").GetString() == "treatment");

        Assert.Equal("bayesian", root.GetProperty("type").GetString());
        Assert.Equal(200, control.GetProperty("n").GetInt64());
        Assert.Equal(80, control.GetProperty("conversions").GetInt64());
        Assert.Equal(0.4, control.GetProperty("rate").GetDouble(), 6);
        Assert.Equal(100, treatment.GetProperty("conversions").GetInt64());
        Assert.Equal(0.5, treatment.GetProperty("rate").GetDouble(), 6);
        Assert.Equal(0.25, treatment.GetProperty("rel_delta").GetDouble(), 6);
        Assert.True(treatment.GetProperty("p_win").GetDouble() > 0.95);
        Assert.True(root.GetProperty("srm").GetProperty("ok").GetBoolean());
    }

    [DockerTheory]
    [InlineData("sum", 12.5, 25.0, 1.0)]
    [InlineData("average", 2.5, 3.0, 0.2)]
    public async Task AnalyzeRun_BayesianContinuous_ReportsPerUserMean(string metricAgg, double controlMean, double treatmentMean, double relDelta)
    {
        var stats = new FixedExperimentStatsService(new ExperimentStatsVm
        {
            EnvId = EnvId,
            FlagKey = "checkout-flow",
            MetricEvent = "revenue",
            Window = new ExperimentStatsWindowVm { Start = "2026-01-01", End = "2026-01-02" },
            Variants =
            [
                Variant("control", users: 100, conversions: 50, sumValue: controlMean * 100, sumSquares: (controlMean * controlMean + 4) * 100),
                Variant("treatment", users: 100, conversions: 60, sumValue: treatmentMean * 100, sumSquares: (treatmentMean * treatmentMean + 4) * 100)
            ]
        });
        await using var db = CreateDbContext();
        await SeedExperimentAsync(db, method: "bayesian_ab", metricType: "numeric", metricAgg: metricAgg, metricEvent: "revenue");

        var result = await CreateService(db, stats).AnalyzeRunAsync(
            EnvId,
            ExperimentId,
            RunId,
            new ExperimentRunAnalyzeRequest());

        using var document = JsonDocument.Parse(result.ExperimentRuns.Single().AnalysisResult);
        var rows = document.RootElement.GetProperty("primary_metric").GetProperty("rows").EnumerateArray().ToArray();
        var control = rows.Single(x => x.GetProperty("variant").GetString() == "control");
        var treatment = rows.Single(x => x.GetProperty("variant").GetString() == "treatment");

        Assert.Equal(controlMean, control.GetProperty("mean").GetDouble(), 4);
        Assert.Equal(treatmentMean, treatment.GetProperty("mean").GetDouble(), 4);
        Assert.Equal(relDelta, treatment.GetProperty("rel_delta").GetDouble(), 6);
    }

    [DockerFact]
    public async Task AnalyzeRun_UnobservedConfiguredArm_KeepsCanonicalVariantIds()
    {
        var stats = new FixedExperimentStatsService(new ExperimentStatsVm
        {
            EnvId = EnvId,
            FlagKey = "checkout-flow",
            MetricEvent = "purchase",
            Window = new ExperimentStatsWindowVm { Start = "2026-01-01", End = "2026-01-02" },
            Variants =
            [
                Variant("treatment-id", users: 1, conversions: 0, sumValue: 0, sumSquares: 0)
            ]
        });
        await using var db = CreateDbContext();
        await SeedExperimentAsync(
            db,
            method: "bayesian_ab",
            metricType: "binary",
            metricAgg: "once",
            controlVariant: "control-id",
            treatmentVariant: "treatment-id");

        var result = await CreateService(db, stats).AnalyzeRunAsync(
            EnvId,
            ExperimentId,
            RunId,
            new ExperimentRunAnalyzeRequest());

        using var document = JsonDocument.Parse(result.ExperimentRuns.Single().AnalysisResult);
        var root = document.RootElement;
        var observed = root.GetProperty("srm").GetProperty("observed");
        var rows = root.GetProperty("primary_metric").GetProperty("rows").EnumerateArray().ToArray();
        var control = rows.Single(x => x.GetProperty("variant").GetString() == "control-id");
        var treatment = rows.Single(x => x.GetProperty("variant").GetString() == "treatment-id");

        Assert.Equal("control-id", root.GetProperty("control").GetString());
        Assert.Equal(0, observed.GetProperty("control-id").GetInt64());
        Assert.Equal(1, observed.GetProperty("treatment-id").GetInt64());
        Assert.Equal(0, control.GetProperty("n").GetInt64());
        Assert.Equal(1, treatment.GetProperty("n").GetInt64());
        Assert.False(root.TryGetProperty("warnings", out _));
    }

    [DockerFact]
    public async Task AnalyzeRun_BanditArmBelowMinimum_KeepsBurnIn()
    {
        var stats = new FixedExperimentStatsService(new ExperimentStatsVm
        {
            EnvId = EnvId,
            FlagKey = "checkout-flow",
            MetricEvent = "purchase",
            Window = new ExperimentStatsWindowVm { Start = "2026-01-01", End = "2026-01-02" },
            Variants =
            [
                Variant("control", users: 120, conversions: 48, sumValue: 48, sumSquares: 48),
                Variant("treatment", users: 80, conversions: 48, sumValue: 48, sumSquares: 48)
            ]
        });
        await using var db = CreateDbContext();
        await SeedExperimentAsync(db, method: "bandit", metricType: "binary", metricAgg: "once");

        var result = await CreateService(db, stats).AnalyzeRunAsync(
            EnvId,
            ExperimentId,
            RunId,
            new ExperimentRunAnalyzeRequest());

        using var document = JsonDocument.Parse(result.ExperimentRuns.Single().AnalysisResult);
        var thompson = document.RootElement.GetProperty("thompson_sampling");

        Assert.Equal("bandit", document.RootElement.GetProperty("type").GetString());
        Assert.False(thompson.GetProperty("enough_units").GetBoolean());
        Assert.Contains("burn-in", thompson.GetProperty("update_message").GetString());
        Assert.Equal(0, thompson.GetProperty("results")[0].GetProperty("recommended_weight").GetDouble());
        Assert.False(document.RootElement.GetProperty("stopping").GetProperty("met").GetBoolean());
    }

    [DockerFact]
    public async Task AnalyzeRun_BanditAfterBurnIn_ReturnsNormalizedWeights()
    {
        var stats = new FixedExperimentStatsService(new ExperimentStatsVm
        {
            EnvId = EnvId,
            FlagKey = "checkout-flow",
            MetricEvent = "purchase",
            Window = new ExperimentStatsWindowVm { Start = "2026-01-01", End = "2026-01-02" },
            Variants =
            [
                Variant("control", users: 200, conversions: 80, sumValue: 80, sumSquares: 80),
                Variant("treatment", users: 200, conversions: 120, sumValue: 120, sumSquares: 120)
            ]
        });
        await using var db = CreateDbContext();
        await SeedExperimentAsync(db, method: "bandit", metricType: "binary", metricAgg: "once");

        var result = await CreateService(db, stats).AnalyzeRunAsync(
            EnvId,
            ExperimentId,
            RunId,
            new ExperimentRunAnalyzeRequest());

        using var document = JsonDocument.Parse(result.ExperimentRuns.Single().AnalysisResult);
        var thompson = document.RootElement.GetProperty("thompson_sampling");
        var rows = thompson.GetProperty("results").EnumerateArray().ToArray();
        var weightSum = rows.Sum(x => x.GetProperty("recommended_weight").GetDouble());
        var treatment = rows.Single(x => x.GetProperty("arm").GetString() == "treatment");

        Assert.True(thompson.GetProperty("enough_units").GetBoolean());
        Assert.Equal(1, weightSum, 6);
        Assert.True(treatment.GetProperty("p_best").GetDouble() > 0.9);
        Assert.True(treatment.GetProperty("recommended_weight").GetDouble() > 0.49);
    }

    [DockerFact]
    public async Task AnalyzeRun_SamplingScope_PassesFieldsToStatsQuery()
    {
        var stats = new FixedExperimentStatsService(new ExperimentStatsVm
        {
            EnvId = EnvId,
            FlagKey = "checkout-flow",
            MetricEvent = "purchase",
            Window = new ExperimentStatsWindowVm { Start = "2026-01-01", End = "2026-01-02" },
            Variants =
            [
                Variant("control", users: 20, conversions: 8, sumValue: 8, sumSquares: 8),
                Variant("treatment", users: 20, conversions: 10, sumValue: 10, sumSquares: 10)
            ]
        });
        await using var db = CreateDbContext();
        await SeedExperimentAsync(
            db,
            method: "bayesian_ab",
            metricType: "binary",
            metricAgg: "once",
            trafficPercent: 20,
            trafficOffset: 10,
            layerId: "checkout-layer",
            assignmentUnitSelector: "accountId",
            layerTrafficPercent: 30,
            analysisSamplingPlan: """[{"variation":"control-id","role":"control","includeRate":25},{"variation":"treatment-id","role":"treatment","includeRate":100}]""");

        await CreateService(db, stats).AnalyzeRunAsync(
            EnvId,
            ExperimentId,
            RunId,
            new ExperimentRunAnalyzeRequest());

        var request = Assert.Single(stats.Requests);
        Assert.Equal(20, request.TrafficPercent);
        Assert.Equal(10, request.TrafficOffset);
        Assert.Equal("checkout-layer", request.LayerId);
        Assert.Equal("accountId", request.AssignmentUnitSelector);
        Assert.Equal(30, request.LayerTrafficPercent);
        Assert.Equal("""[{"variation":"control-id","role":"control","includeRate":25},{"variation":"treatment-id","role":"treatment","includeRate":100}]""", request.AnalysisSamplingPlan);
        Assert.Equal("control-id", request.ControlVariant);
        Assert.Equal("treatment-id", request.TreatmentVariants);
    }

    private static ExperimentService CreateService(
        AppDbContext db,
        IExperimentStatsService stats)
    {
        return new ExperimentService(
            db,
            stats,
            CreateFeatureFlagService(),
            null!,
            new TestCurrentUser(UserId),
            CreateUserService());
    }

    private AppDbContext CreateDbContext()
    {
        return _fixture.CreateDbContext();
    }

    private static async Task SeedExperimentAsync(
        AppDbContext db,
        string method,
        string metricType,
        string metricAgg,
        string metricEvent = "purchase",
        string controlVariant = "control",
        string treatmentVariant = "treatment",
        double? trafficPercent = null,
        int? trafficOffset = null,
        string? layerId = null,
        string? assignmentUnitSelector = null,
        double? layerTrafficPercent = null,
        string? analysisSamplingPlan = null)
    {
        await db.Database.ExecuteSqlRawAsync(
            "TRUNCATE TABLE experiment_activities, experiment_runs, experiments RESTART IDENTITY CASCADE;");

        var experiment = new Experiment
        {
            Id = ExperimentId,
            Name = "Checkout flow",
            Stage = "experiment",
            FlagKey = "checkout-flow",
            FeatBitProjectKey = "web",
            FeatBitEnvId = EnvId,
            PrimaryMetric = """{"event":"purchase","metricType":"binary","metricAgg":"once","expectedDirection":"increase"}""",
            Guardrails = "[]",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var run = new ExperimentRun
        {
            Id = RunId,
            ExperimentId = ExperimentId,
            Slug = "run-1",
            Status = "running",
            Method = method,
            PrimaryMetricEvent = metricEvent,
            PrimaryMetricType = metricType,
            PrimaryMetricAgg = metricAgg,
            ControlVariant = controlVariant,
            TreatmentVariant = treatmentVariant,
            TrafficPercent = trafficPercent,
            TrafficOffset = trafficOffset,
            LayerId = layerId,
            AssignmentUnitSelector = assignmentUnitSelector,
            LayerTrafficPercent = layerTrafficPercent,
            AnalysisSamplingPlan = analysisSamplingPlan,
            ObservationStart = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            ObservationEnd = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await db.Set<Experiment>().AddAsync(experiment);
        await db.Set<ExperimentRun>().AddAsync(run);
        await db.SaveChangesAsync();
    }

    private static ExperimentVariantStatsVm Variant(
        string variant,
        long users,
        long conversions,
        double sumValue,
        double sumSquares)
    {
        return new ExperimentVariantStatsVm
        {
            Variant = variant,
            Users = users,
            Conversions = conversions,
            SumValue = sumValue,
            SumSquares = sumSquares,
            ConversionRate = users == 0 ? 0 : (double)conversions / users,
            AvgValue = users == 0 ? 0 : sumValue / users
        };
    }

    private sealed class FixedExperimentStatsService(ExperimentStatsVm stats) : IExperimentStatsService
    {
        public List<QueryExperimentStats> Requests { get; } = [];

        public Task<ExperimentStatsVm> QueryAsync(QueryExperimentStats request)
        {
            Requests.Add(request);
            return Task.FromResult(new ExperimentStatsVm
            {
                EnvId = request.EnvId,
                FlagKey = request.FlagKey,
                MetricEvent = request.MetricEvent,
                Window = new ExperimentStatsWindowVm
                {
                    Start = request.StartDate,
                    End = request.EndDate
                },
                Variants = stats.Variants
            });
        }
    }

    private static IFeatureFlagService CreateFeatureFlagService()
    {
        var service = new Mock<IFeatureFlagService>();
        service
            .Setup(x => x.GetAsync(It.IsAny<Guid>(), It.IsAny<string>()))
            .ReturnsAsync((Guid envId, string key) => new FeatureFlag
            {
                Id = Guid.Parse("44444444-4444-4444-4444-444444444444"),
                EnvId = envId,
                Key = key,
                Name = "Checkout flow",
                VariationType = "string",
                DisabledVariationId = "control-id",
                Variations =
                [
                    new Variation { Id = "control-id", Name = "control", Value = "true" },
                    new Variation { Id = "treatment-id", Name = "treatment", Value = "false" }
                ],
                Tags = []
            });
        return service.Object;
    }

    private static IUserService CreateUserService()
    {
        var user = new User(UserId, "experiment@example.com", "hashed", "Experiment Tester");
        var service = new Mock<IUserService>();
        service
            .Setup(x => x.GetOperatorAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => id == user.Id ? user.Name : string.Empty);
        service
            .Setup(x => x.GetListAsync(It.IsAny<IEnumerable<Guid>>()))
            .ReturnsAsync((IEnumerable<Guid> ids) =>
                (ICollection<User>)(ids.Contains(user.Id) ? [user] : Array.Empty<User>()));
        service
            .Setup(x => x.GetAsync(user.Id))
            .ReturnsAsync(user);
        service
            .Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<User, bool>>>()))
            .ReturnsAsync((Expression<Func<User, bool>> predicate) =>
                predicate.Compile()(user) ? user : null);
        return service.Object;
    }

    private sealed class TestCurrentUser(Guid id) : ICurrentUser
    {
        public Guid Id { get; } = id;
    }
}
