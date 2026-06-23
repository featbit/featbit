using System.Linq.Expressions;
using System.Text.Json;
using Application.Bases.Models;
using Application.ExperimentStats;
using Application.FeatureFlags;
using Application.ReleaseDecisions;
using Application.Services;
using Domain.FeatureFlags;
using Domain.ReleaseDecisions;
using Domain.Segments;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Services.EntityFrameworkCore;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Application.UnitTests.ReleaseDecisions;

public class ReleaseDecisionAnalysisAlgorithmTests
{
    private static readonly Guid EnvId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid ExperimentId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid RunId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public async Task Bayesian_binary_analysis_reports_conversion_rate_and_win_probability()
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
            new ReleaseDecisionExperimentRunAnalyzeRequest());

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

    [Theory]
    [InlineData("sum", 12.5, 25.0, 1.0)]
    [InlineData("average", 2.5, 3.0, 0.2)]
    public async Task Bayesian_continuous_analysis_reports_per_user_mean(string metricAgg, double controlMean, double treatmentMean, double relDelta)
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
        await SeedExperimentAsync(db, method: "bayesian_ab", metricType: "continuous", metricAgg: metricAgg, metricEvent: "revenue");

        var result = await CreateService(db, stats).AnalyzeRunAsync(
            EnvId,
            ExperimentId,
            RunId,
            new ReleaseDecisionExperimentRunAnalyzeRequest());

        using var document = JsonDocument.Parse(result.ExperimentRuns.Single().AnalysisResult);
        var rows = document.RootElement.GetProperty("primary_metric").GetProperty("rows").EnumerateArray().ToArray();
        var control = rows.Single(x => x.GetProperty("variant").GetString() == "control");
        var treatment = rows.Single(x => x.GetProperty("variant").GetString() == "treatment");

        Assert.Equal(controlMean, control.GetProperty("mean").GetDouble(), 4);
        Assert.Equal(treatmentMean, treatment.GetProperty("mean").GetDouble(), 4);
        Assert.Equal(relDelta, treatment.GetProperty("rel_delta").GetDouble(), 6);
    }

    [Fact]
    public async Task Bayesian_analysis_keeps_canonical_variant_ids_when_a_configured_arm_has_no_observations()
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
            new ReleaseDecisionExperimentRunAnalyzeRequest());

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

    [Fact]
    public async Task Bandit_analysis_keeps_burn_in_when_an_arm_has_too_few_users()
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
            new ReleaseDecisionExperimentRunAnalyzeRequest());

        using var document = JsonDocument.Parse(result.ExperimentRuns.Single().AnalysisResult);
        var thompson = document.RootElement.GetProperty("thompson_sampling");

        Assert.Equal("bandit", document.RootElement.GetProperty("type").GetString());
        Assert.False(thompson.GetProperty("enough_units").GetBoolean());
        Assert.Contains("burn-in", thompson.GetProperty("update_message").GetString());
        Assert.Equal(0, thompson.GetProperty("results")[0].GetProperty("recommended_weight").GetDouble());
        Assert.False(document.RootElement.GetProperty("stopping").GetProperty("met").GetBoolean());
    }

    [Fact]
    public async Task Bandit_analysis_returns_normalized_weights_after_burn_in()
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
            new ReleaseDecisionExperimentRunAnalyzeRequest());

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

    private static ReleaseDecisionExperimentService CreateService(
        AppDbContext db,
        IExperimentStatsService stats)
    {
        return new ReleaseDecisionExperimentService(db, stats, new TestFeatureFlagService());
    }

    private static AppDbContext CreateDbContext()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .Options;

        var db = new TestReleaseDecisionDbContext(options);
        db.Database.EnsureCreated();

        return db;
    }

    private static async Task SeedExperimentAsync(
        AppDbContext db,
        string method,
        string metricType,
        string metricAgg,
        string metricEvent = "purchase",
        string controlVariant = "control",
        string treatmentVariant = "treatment")
    {
        var experiment = new ReleaseDecisionExperiment
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
        var run = new ReleaseDecisionExperimentRun
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
            ObservationStart = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            ObservationEnd = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await db.Set<ReleaseDecisionExperiment>().AddAsync(experiment);
        await db.Set<ReleaseDecisionExperimentRun>().AddAsync(run);
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
        public Task<ExperimentStatsVm> QueryAsync(QueryExperimentStats request)
        {
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

    private sealed class TestReleaseDecisionDbContext(DbContextOptions<AppDbContext> options) : AppDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<ReleaseDecisionExperiment>(builder =>
            {
                builder.HasKey(x => x.Id);
                builder.Property(x => x.Name).IsRequired();
                builder.Property(x => x.Stage).IsRequired();
                builder.Ignore(x => x.ExperimentRuns);
                builder.Ignore(x => x.Activities);
            });

            modelBuilder.Entity<ReleaseDecisionExperimentRun>(builder =>
            {
                builder.HasKey(x => x.Id);
                builder.Property(x => x.Slug).IsRequired();
                builder.Property(x => x.Status).IsRequired();
                builder.Ignore(x => x.Experiment);
            });

            modelBuilder.Entity<ReleaseDecisionActivity>(builder =>
            {
                builder.HasKey(x => x.Id);
                builder.Ignore(x => x.Experiment);
            });
        }
    }

    private sealed class TestFeatureFlagService : IFeatureFlagService
    {
        public Task<FeatureFlag> GetAsync(Guid envId, string key)
        {
            return Task.FromResult(new FeatureFlag
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
        }

        public Task<FeatureFlag> GetAsync(Guid id) => throw new NotImplementedException();
        public Task AddOneAsync(FeatureFlag segment) => throw new NotImplementedException();
        public Task AddManyAsync(IEnumerable<FeatureFlag> entities) => throw new NotImplementedException();
        public Task<FeatureFlag?> FindOneAsync(Expression<Func<FeatureFlag, bool>> predicate) => throw new NotImplementedException();
        public Task<ICollection<FeatureFlag>> FindManyAsync(Expression<Func<FeatureFlag, bool>> predicate) => throw new NotImplementedException();
        public Task<long> CountAsync(Expression<Func<FeatureFlag, bool>> predicate) => throw new NotImplementedException();
        public Task<bool> AnyAsync(Expression<Func<FeatureFlag, bool>> predicate) => throw new NotImplementedException();
        public Task UpdateAsync(FeatureFlag segment) => throw new NotImplementedException();
        public Task DeleteOneAsync(Guid id) => throw new NotImplementedException();
        public Task<PagedResult<FeatureFlag>> GetListAsync(Guid envId, FeatureFlagFilter filter) => throw new NotImplementedException();
        public Task<bool> HasKeyBeenUsedAsync(Guid envId, string key) => throw new NotImplementedException();
        public Task<ICollection<string>> GetAllTagsAsync(Guid envId) => throw new NotImplementedException();
        public Task<ICollection<Segment>> GetRelatedSegmentsAsync(ICollection<FeatureFlag> flags) => throw new NotImplementedException();
        public Task MarkAsUpdatedAsync(ICollection<Guid> flagIds, Guid operatorId) => throw new NotImplementedException();
    }
}
