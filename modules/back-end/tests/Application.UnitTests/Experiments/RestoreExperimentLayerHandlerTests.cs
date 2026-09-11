using Application.Experiments.ExperimentLayers;
using Application.Services;

namespace Application.UnitTests.Experiments;

public class RestoreExperimentLayerHandlerTests
{
    [Fact]
    public async Task ArchiveHandle_ArchivesTheRequestedLayer()
    {
        var envId = Guid.NewGuid();
        var layerId = Guid.NewGuid();
        var service = new Mock<IExperimentLayerService>();
        var handler = new ArchiveExperimentLayerHandler(service.Object);

        var archived = await handler.Handle(new ArchiveExperimentLayer
        {
            EnvId = envId,
            Id = layerId
        }, CancellationToken.None);

        Assert.True(archived);
        service.Verify(x => x.ArchiveAsync(envId, layerId), Times.Once);
    }

    [Fact]
    public async Task Handle_RestoresTheRequestedLayer()
    {
        var envId = Guid.NewGuid();
        var layerId = Guid.NewGuid();
        var service = new Mock<IExperimentLayerService>();
        var handler = new RestoreExperimentLayerHandler(service.Object);

        var restored = await handler.Handle(new RestoreExperimentLayer
        {
            EnvId = envId,
            Id = layerId
        }, CancellationToken.None);

        Assert.True(restored);
        service.Verify(x => x.RestoreAsync(envId, layerId), Times.Once);
    }
}
