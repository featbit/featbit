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
        var run = Assert.Single((await service.CreateRunAsync(envId, created.Id, new ExperimentRunCreate { ControlVariant = "control", TreatmentVariants = ["treatment"] })).ExperimentRuns);

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

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task RunSnapshot_CreationIsAtomic_AndFlagEditsDoNotChangeItsOptions(string provider)
    {
        var envId = Guid.NewGuid();
        var flags = fixture.CreateFeatureFlagService(provider);
        var flag = Flag(envId, "snapshot");
        flag.Variations.Add(new Variation { Id = "third", Name = "Third", Value = "third-value" });
        await flags.AddOneAsync(flag);
        var service = Service(provider);
        var experiment = await service.CreateAsync(Experiment(envId, flag.Id));
        var start = DateTime.UtcNow.AddDays(-1);
        var end = DateTime.UtcNow;
        var setup = new ExperimentRunCreate
        {
            ControlVariant = "treatment", TreatmentVariants = ["control"],
            MinimumSample = 500, ObservationStart = start, ObservationEnd = end
        };
        var created = Assert.Single((await service.CreateRunAsync(envId, experiment.Id, setup)).ExperimentRuns);
        Assert.Equal("treatment", created.ControlVariant);
        Assert.Equal(new[] { "control" }, created.TreatmentVariants);
        Assert.Equal(500, created.MinimumSample);
        Assert.Equal(3, created.Variations.Count);
        Assert.True(Math.Abs((created.ObservationStart!.Value - start).TotalMilliseconds) < 1);
        Assert.True(Math.Abs((created.ObservationEnd!.Value - end).TotalMilliseconds) < 1);

        flag.Variations = [new Variation { Id = "new", Name = "New", Value = "new-value" }];
        await flags.UpdateAsync(flag);
        var read = Assert.Single((await Service(provider).GetAsync(envId, experiment.Id)).ExperimentRuns);
        Assert.Equal("third-value", read.Variations.Single(x => x.Id == "third").Value);
        Assert.DoesNotContain(read.Variations, x => x.Id == "new");

        await Service(provider).UpdateRunAsync(envId, experiment.Id, created.Id,
            new ExperimentRunUpdate { AnalysisResult = "old analysis" });
        var updated = Assert.Single((await Service(provider).UpdateRunAudienceAsync(envId, experiment.Id, created.Id,
            new ExperimentRunAudienceUpdate { ControlVariant = "control", TreatmentVariants = ["third"] })).ExperimentRuns);
        Assert.Null(updated.AnalysisResult);
        Assert.Equal(3, updated.Variations.Count);
        Assert.Equal(new[] { "third" }, updated.TreatmentVariants);
        await Assert.ThrowsAsync<BusinessException>(() => Service(provider).UpdateRunAsync(envId, experiment.Id, created.Id,
            new ExperimentRunUpdate { ControlVariant = "new", TreatmentVariants = ["third"] }));
        await Assert.ThrowsAsync<BusinessException>(() => Service(provider).UpdateRunAudienceAsync(envId, experiment.Id, created.Id,
            new ExperimentRunAudienceUpdate { ControlVariant = "control", TreatmentVariants = ["third", "third"] }));
        var persisted = Assert.Single((await Service(provider).GetAsync(envId, experiment.Id)).ExperimentRuns);
        Assert.Equal("control", persisted.ControlVariant);
        Assert.Equal(new[] { "third" }, persisted.TreatmentVariants);
        var stats = new Mock<IExperimentStatsService>();
        stats.Setup(x => x.QueryAsync(It.IsAny<QueryExperimentStats>()))
            .ReturnsAsync(new ExperimentStatsVm { Variants = [] });
        var analysisService = fixture.CreateExperimentServices(provider, stats.Object).ExperimentService;
        var analyzed = Assert.Single((await analysisService.AnalyzeRunAsync(envId, experiment.Id, created.Id,
            new ExperimentRunAnalyzeRequest())).ExperimentRuns);
        Assert.Equal("third-value", analyzed.Variations.Single(x => x.Id == "third").Value);
        stats.Verify(x => x.QueryAsync(It.Is<QueryExperimentStats>(query =>
            query.ControlVariant == "control" && query.TreatmentVariants.Single() == "third")), Times.Once);

        await Assert.ThrowsAsync<BusinessException>(() => Service(provider).CreateRunAsync(envId, experiment.Id, setup));
        Assert.Single((await Service(provider).GetAsync(envId, experiment.Id)).ExperimentRuns);
    }

    [DockerTheory]
    [InlineData("Postgres", false)]
    [InlineData("Postgres", true)]
    [InlineData("MongoDb", false)]
    [InlineData("MongoDb", true)]
    public async Task DecidedRun_RejectsRoleChanges_AndPreservesAnalysisAndDecision(string provider, bool audience)
    {
        var envId = Guid.NewGuid();
        var flag = Flag(envId, "decided-run");
        await fixture.CreateFeatureFlagService(provider).AddOneAsync(flag);
        var experiment = await Service(provider).CreateAsync(Experiment(envId, flag.Id));
        var run = Assert.Single((await Service(provider).CreateRunAsync(envId, experiment.Id, new ExperimentRunCreate { ControlVariant = "control", TreatmentVariants = ["treatment"] })).ExperimentRuns);
        await Service(provider).UpdateRunAsync(envId, experiment.Id, run.Id, new ExperimentRunUpdate
        {
            AnalysisResult = "original analysis", Decision = "ADOPT",
            DecisionSummary = "Original summary", DecisionReason = "Original reason"
        });
        var error = await Assert.ThrowsAsync<BusinessException>(() => audience
            ? Service(provider).UpdateRunAudienceAsync(envId, experiment.Id, run.Id,
                new ExperimentRunAudienceUpdate { ControlVariant = "treatment", TreatmentVariants = ["control"] })
            : Service(provider).UpdateRunAsync(envId, experiment.Id, run.Id,
                new ExperimentRunUpdate { ControlVariant = "treatment", TreatmentVariants = ["control"], Decision = "" }));
        Assert.Equal("experiment_run_decision_locks_variations", error.Message);
        var saved = Assert.Single((await Service(provider).GetAsync(envId, experiment.Id)).ExperimentRuns);
        Assert.Equal("control", saved.ControlVariant);
        Assert.Equal(new[] { "treatment" }, saved.TreatmentVariants);
        Assert.Equal("original analysis", saved.AnalysisResult);
        Assert.Equal("ADOPT", saved.Decision);
        Assert.Equal("Original summary", saved.DecisionSummary);
        Assert.Equal("Original reason", saved.DecisionReason);
        var unchanged = Assert.Single((await Service(provider).UpdateRunAsync(envId, experiment.Id, run.Id,
            new ExperimentRunUpdate { ControlVariant = "control", TreatmentVariants = ["treatment"], MinimumSample = 100 })).ExperimentRuns);
        Assert.Equal("original analysis", unchanged.AnalysisResult);
        Assert.Equal("ADOPT", unchanged.Decision);
    }

    [DockerTheory]
    [InlineData("Postgres")]
    [InlineData("MongoDb")]
    public async Task CreateRun_RequiresSetupAndExplicitRoles(string provider)
    {
        var envId = Guid.NewGuid();
        var flag = Flag(envId, "required-setup");
        await fixture.CreateFeatureFlagService(provider).AddOneAsync(flag);
        var experiment = await Service(provider).CreateAsync(Experiment(envId, flag.Id));
        await Assert.ThrowsAsync<ArgumentNullException>(() =>
            Service(provider).CreateRunAsync(envId, experiment.Id, null!));
        await Assert.ThrowsAsync<BusinessException>(() =>
            Service(provider).CreateRunAsync(envId, experiment.Id, new ExperimentRunCreate()));
        Assert.Empty((await Service(provider).GetAsync(envId, experiment.Id)).ExperimentRuns);
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
