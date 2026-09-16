using Application.Bases.Exceptions;
using Application.Experiments;
using Application.ExperimentStats;
using Application.Services;
using Domain.Experiments;
using Domain.FeatureFlags;
using Moq;

namespace Infrastructure.IntegrationTests.Experiments;

[Collection(nameof(ExperimentProviderParityCollection))]
public class ExperimentFlagBindingTests(ExperimentProviderParityFixture fixture) : IntegrationTestBase
{
    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task Binding_PersistsIds_ResolvesDisplayFields_AndFiltersExactly(string provider)
    {
        var envId = Guid.NewGuid();
        var flags = fixture.CreateFeatureFlagService(provider);
        var first = Flag(envId, "checkout");
        var second = Flag(envId, "checkout-next");
        await flags.AddManyAsync([first, second]);
        var service = Service(provider);

        var created = await service.CreateAsync(Experiment(envId, first.Id));
        Assert.Equal(first.Id, created.FlagId);
        Assert.Equal(first.Key, created.FlagKey);
        Assert.Equal(first.Name, created.FlagName);
        Assert.Null(typeof(Experiment).GetProperty("FlagKey"));

        await service.CreateAsync(Experiment(envId, first.Id));
        var other = await service.CreateAsync(Experiment(envId, second.Id));
        var unbound = await service.CreateAsync(Experiment(envId));
        Assert.Null(unbound.FlagId);
        Assert.Null(unbound.FlagKey);
        Assert.Null(unbound.FlagName);

        var page = await Service(provider).GetListAsync(envId, new ExperimentFilter { FlagId = first.Id });
        Assert.Equal(2, page.TotalCount);
        Assert.All(page.Items, item =>
        {
            Assert.Equal(first.Id, item.FlagId);
            Assert.Equal(first.Key, item.FlagKey);
            Assert.Equal(first.Name, item.FlagName);
            Assert.NotNull(item.StateSummary);
        });

        var changed = await service.UpdateAsync(envId, created.Id, new ExperimentUpdate { FlagId = second.Id });
        Assert.Equal(second.Id, changed.FlagId);
        Assert.Equal(second.Key, changed.FlagKey);
        var unchanged = await service.UpdateAsync(envId, created.Id, new ExperimentUpdate { Description = "Updated" });
        Assert.Equal(second.Id, unchanged.FlagId);
        Assert.Equal("Updated", unchanged.Description);
        Assert.Equal(second.Name, (await Service(provider).GetAsync(envId, created.Id)).FlagName);
        Assert.Equal(second.Id, other.FlagId);
    }

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task Binding_RejectsEmptyMissingAndCrossEnvironmentIds_WithoutChangingBinding(string provider)
    {
        var envId = Guid.NewGuid();
        var flags = fixture.CreateFeatureFlagService(provider);
        var local = Flag(envId, "checkout");
        var foreign = Flag(Guid.NewGuid(), local.Key);
        await flags.AddManyAsync([local, foreign]);
        var service = Service(provider);
        var created = await service.CreateAsync(Experiment(envId, local.Id));

        await Assert.ThrowsAsync<BusinessException>(() => service.CreateAsync(Experiment(envId, Guid.Empty)));
        await Assert.ThrowsAsync<EntityNotFoundException>(() => service.CreateAsync(Experiment(envId, Guid.NewGuid())));
        await Assert.ThrowsAsync<EntityNotFoundException>(() => service.CreateAsync(Experiment(envId, foreign.Id)));
        await Assert.ThrowsAsync<BusinessException>(() => service.UpdateAsync(envId, created.Id, new ExperimentUpdate { FlagId = Guid.Empty }));
        await Assert.ThrowsAsync<EntityNotFoundException>(() => service.UpdateAsync(envId, created.Id, new ExperimentUpdate { FlagId = Guid.NewGuid() }));
        await Assert.ThrowsAsync<EntityNotFoundException>(() => service.UpdateAsync(envId, created.Id, new ExperimentUpdate { FlagId = foreign.Id }));

        Assert.Equal(local.Id, (await Service(provider).GetAsync(envId, created.Id)).FlagId);
        Assert.Equal(1, (await Service(provider).GetListAsync(envId, new ExperimentFilter())).TotalCount);
        Assert.Equal(0, (await Service(provider).GetListAsync(foreign.EnvId, new ExperimentFilter { FlagId = local.Id })).TotalCount);
    }

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task DeletedFlag_DoesNotRebindToReusedKey_AndCannotBeAnalyzed(string provider)
    {
        var envId = Guid.NewGuid();
        var flags = fixture.CreateFeatureFlagService(provider);
        var original = Flag(envId, "checkout");
        await flags.AddOneAsync(original);
        var stats = new Mock<IExperimentStatsService>(MockBehavior.Strict);
        var service = fixture.CreateExperimentServices(provider, stats.Object).ExperimentService;
        var created = await service.CreateAsync(Experiment(envId, original.Id));
        var run = Assert.Single((await service.CreateRunAsync(envId, created.Id)).ExperimentRuns);

        await flags.DeleteOneAsync(original.Id);
        var replacement = Flag(envId, original.Key);
        await flags.AddOneAsync(replacement);

        var detail = await service.GetAsync(envId, created.Id);
        Assert.Equal(original.Id, detail.FlagId);
        Assert.Null(detail.FlagKey);
        Assert.Null(detail.FlagName);
        var item = Assert.Single((await service.GetListAsync(envId, new ExperimentFilter { FlagId = original.Id })).Items);
        Assert.Null(item.FlagKey);
        Assert.Equal(0, (await service.GetListAsync(envId, new ExperimentFilter { FlagId = replacement.Id })).TotalCount);
        await Assert.ThrowsAsync<EntityNotFoundException>(() => service.AnalyzeRunAsync(envId, created.Id, run.Id, new ExperimentRunAnalyzeRequest()));
        stats.Verify(x => x.QueryAsync(It.IsAny<QueryExperimentStats>()), Times.Never);

        Assert.Equal(replacement.Id,
            (await service.UpdateAsync(envId, created.Id, new ExperimentUpdate { FlagId = replacement.Id })).FlagId);
    }

    private IExperimentService Service(string provider) => fixture.CreateExperimentServices(provider).ExperimentService;

    private static Experiment Experiment(Guid envId, Guid? flagId = null) => new()
    {
        Id = Guid.NewGuid(), EnvId = envId, FlagId = flagId, Name = "Flag binding test",
        PrimaryMetric = new PrimaryMetricConfig { MetricId = Guid.NewGuid(), MetricKey = "purchase", EventName = "purchase" },
        CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
    };

    private static FeatureFlag Flag(Guid envId, string key) => new(
        envId, $"{key} display name", "", key, true, "boolean",
        [new Variation { Id = "control", Name = "Control", Value = "false" },
         new Variation { Id = "treatment", Name = "Treatment", Value = "true" }],
        "control", "treatment", [], Guid.NewGuid());
}
