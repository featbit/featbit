using Application.Experiments.ExperimentMetrics;
using Application.Services;

namespace Application.UnitTests.Experiments;

public class ExperimentMetricLifecycleHandlerTests
{
    [Fact]
    public async Task ArchiveHandle_ArchivesTheRequestedMetric()
    {
        var envId = Guid.NewGuid();
        var metricId = Guid.NewGuid();
        var service = new Mock<IExperimentMetricService>();
        var handler = new ArchiveExperimentMetricHandler(service.Object);

        var archived = await handler.Handle(new ArchiveExperimentMetric
        {
            EnvId = envId,
            Id = metricId
        }, CancellationToken.None);

        Assert.True(archived);
        service.Verify(x => x.ArchiveAsync(envId, metricId), Times.Once);
    }

    [Fact]
    public async Task RestoreHandle_RestoresTheRequestedMetric()
    {
        var envId = Guid.NewGuid();
        var metricId = Guid.NewGuid();
        var service = new Mock<IExperimentMetricService>();
        var handler = new RestoreExperimentMetricHandler(service.Object);

        var restored = await handler.Handle(new RestoreExperimentMetric
        {
            EnvId = envId,
            Id = metricId
        }, CancellationToken.None);

        Assert.True(restored);
        service.Verify(x => x.RestoreAsync(envId, metricId), Times.Once);
    }
}
