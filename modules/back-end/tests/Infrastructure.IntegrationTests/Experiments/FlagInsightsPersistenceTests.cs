using Application.Bases;
using Application.Bases.Exceptions;
using Application.Experiments;
using Domain.Experiments;
using Domain.FeatureFlags;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.IntegrationTests.Experiments;

/// <summary>
/// Per-flag insights toggle against real stores: the flag field round-trips in both providers, and the
/// running-experiment query that guards disabling insights returns the same result in both.
/// </summary>
[Collection(nameof(ExperimentProviderParityCollection))]
public class FlagInsightsPersistenceTests(ExperimentProviderParityFixture fixture) : IntegrationTestBase
{
    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task InsightsEnabled_Disabled_RoundTrips(string provider)
    {
        var envId = Guid.NewGuid();
        var flags = fixture.CreateFeatureFlagService(provider);
        var flag = Flag(envId, "insights-off");
        flag.InsightsEnabled = false;
        await flags.AddManyAsync([flag]);

        var stored = await fixture.CreateFeatureFlagService(provider).GetAsync(envId, flag.Key);

        Assert.False(stored.InsightsEnabled);
    }

    [DockerFact]
    public async Task InsightsEnabled_MongoDocumentWithoutField_ReadsTrue()
    {
        var envId = Guid.NewGuid();
        var flag = Flag(envId, "legacy");
        flag.InsightsEnabled = false;
        await fixture.CreateFeatureFlagService("MongoDb").AddManyAsync([flag]);
        await fixture.CreateMongoDbClient().CollectionOf("FeatureFlags").UpdateOneAsync(
            Builders<BsonDocument>.Filter.Eq("_id", flag.Id),
            Builders<BsonDocument>.Update.Unset("insightsEnabled"));

        var stored = await fixture.CreateFeatureFlagService("MongoDb").GetAsync(envId, flag.Key);

        Assert.True(stored.InsightsEnabled);
    }

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task GetRunningForFlagAsync_MixedRuns_ReturnsOnlyUnendedRunsOfThatFlag(string provider)
    {
        var envId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var flags = fixture.CreateFeatureFlagService(provider);
        var flag = Flag(envId, "guarded");
        var otherFlag = Flag(envId, "other");
        await flags.AddManyAsync([flag, otherFlag]);
        var service = fixture.CreateExperimentServices(provider).ExperimentService;

        var open = await service.CreateAsync(Experiment(envId, flag.Id, "open"));
        var future = await service.CreateAsync(Experiment(envId, flag.Id, "future"));
        var ended = await service.CreateAsync(Experiment(envId, flag.Id, "ended"));
        var otherFlagOpen = await service.CreateAsync(Experiment(envId, otherFlag.Id, "other flag"));
        await service.CreateRunAsync(envId, open.Id, Run(now.AddDays(-1), null));
        await service.CreateRunAsync(envId, future.Id, Run(now.AddDays(1), null));
        await service.CreateRunAsync(envId, ended.Id, Run(now.AddDays(-2), now.AddDays(-1)));
        await service.CreateRunAsync(envId, otherFlagOpen.Id, Run(now.AddDays(-1), null));

        var running = await service.GetRunningForFlagAsync(envId, flag.Id, now);

        Assert.Equal(
            new[] { open.Id, future.Id }.OrderBy(x => x),
            running.Select(x => x.Id).OrderBy(x => x));
        Assert.Contains(running, x => x.Name == "open");
    }

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task CreateRunAsync_FlagInsightsDisabled_RejectsUnendedRunOnly(string provider)
    {
        var envId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var flag = Flag(envId, "no-insights");
        flag.InsightsEnabled = false;
        await fixture.CreateFeatureFlagService(provider).AddManyAsync([flag]);
        var service = fixture.CreateExperimentServices(provider).ExperimentService;
        var experiment = await service.CreateAsync(Experiment(envId, flag.Id, "blocked"));

        var ex = await Assert.ThrowsAsync<BusinessException>(
            () => service.CreateRunAsync(envId, experiment.Id, Run(now, null)));
        await service.CreateRunAsync(envId, experiment.Id, Run(now.AddDays(-2), now.AddDays(-1)));

        Assert.Equal(ErrorCodes.InsightsDisabled, ex.Message);
        Assert.Single((await service.GetAsync(envId, experiment.Id)).ExperimentRuns);
    }

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task UpdateRunObservationWindowAsync_ReopeningOnFlagWithInsightsDisabled_Rejects(string provider)
    {
        var envId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var flags = fixture.CreateFeatureFlagService(provider);
        var flag = Flag(envId, "reopen");
        await flags.AddManyAsync([flag]);
        var service = fixture.CreateExperimentServices(provider).ExperimentService;
        var experiment = await service.CreateAsync(Experiment(envId, flag.Id, "reopen"));
        var created = await service.CreateRunAsync(envId, experiment.Id, Run(now.AddDays(-2), now.AddDays(-1)));
        var runId = Assert.Single(created.ExperimentRuns).Id;
        flag.InsightsEnabled = false;
        await flags.UpdateAsync(flag);

        var ex = await Assert.ThrowsAsync<BusinessException>(() => service.UpdateRunObservationWindowAsync(
            envId, experiment.Id, runId,
            new ExperimentRunObservationWindowUpdate { ObservationStart = now.AddDays(-2), ObservationEnd = null }));

        Assert.Equal(ErrorCodes.InsightsDisabled, ex.Message);
    }

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task UpdateAsync_BindingFlagWithInsightsDisabledToRunningExperiment_Rejects(string provider)
    {
        var envId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var enabled = Flag(envId, "enabled");
        var disabled = Flag(envId, "disabled");
        disabled.InsightsEnabled = false;
        await fixture.CreateFeatureFlagService(provider).AddManyAsync([enabled, disabled]);
        var service = fixture.CreateExperimentServices(provider).ExperimentService;
        var experiment = await service.CreateAsync(Experiment(envId, enabled.Id, "rebind"));
        await service.CreateRunAsync(envId, experiment.Id, Run(now.AddDays(-1), null));

        var ex = await Assert.ThrowsAsync<BusinessException>(
            () => service.UpdateAsync(envId, experiment.Id, new ExperimentUpdate { FlagId = disabled.Id }));

        Assert.Equal(ErrorCodes.InsightsDisabled, ex.Message);
        Assert.Equal(enabled.Id, (await service.GetAsync(envId, experiment.Id)).FlagId);
    }

    private static ExperimentRunCreate Run(DateTime start, DateTime? end) => new()
    {
        ControlVariant = "control",
        TreatmentVariants = ["treatment"],
        ObservationStart = start,
        ObservationEnd = end
    };

    private static Experiment Experiment(Guid envId, Guid flagId, string name) => new()
    {
        Id = Guid.NewGuid(), EnvId = envId, FlagId = flagId, Name = name,
        PrimaryMetric = new PrimaryMetricConfig { MetricId = Guid.NewGuid(), MetricKey = "purchase", EventName = "purchase" },
        CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
    };

    private static FeatureFlag Flag(Guid envId, string key) => new(
        envId, $"{key} display name", "", key, true, "boolean",
        [new Variation { Id = "control", Name = "Control", Value = "false" },
         new Variation { Id = "treatment", Name = "Treatment", Value = "true" }],
        "control", "treatment", [], Guid.NewGuid());
}
