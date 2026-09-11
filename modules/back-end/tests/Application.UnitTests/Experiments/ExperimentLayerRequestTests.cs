using Application.Experiments.ExperimentLayers;

namespace Application.UnitTests.Experiments;

public class ExperimentLayerRequestTests
{
    [Fact]
    public void UpdateRequest_DoesNotExposeKeyOrStatus()
    {
        Assert.Null(typeof(UpdateExperimentLayerRequest).GetProperty("Key"));
        Assert.Null(typeof(UpdateExperimentLayerRequest).GetProperty("Status"));
    }

    [Fact]
    public void CreateRequest_DoesNotExposeStatus()
    {
        Assert.NotNull(typeof(CreateExperimentLayerRequest).GetProperty("Key"));
        Assert.Null(typeof(CreateExperimentLayerRequest).GetProperty("Status"));
    }
}
