using Application.Bases.Models;
using Application.Experiments;
using Application.Experiments.ExperimentLayers;
using Application.Services;
using AutoMapper;
using Domain.Experiments;

namespace Application.UnitTests.Experiments;

public class GetExperimentLayersHandlerTests
{
    [Fact]
    public async Task Handle_CombinesPagedLayersWithTheirExperimentRuns()
    {
        var envId = Guid.NewGuid();
        var layer = NewLayer(envId);
        var filter = new ExperimentLayerFilter { PageIndex = 2, PageSize = 10 };
        var page = new PagedResult<ExperimentLayer>(11, [layer]);
        var run = new ExperimentRunForLayer
        {
            ExperimentName = "Checkout pricing",
            Run = new ExperimentRun
            {
                Id = Guid.NewGuid(),
                ExperimentId = Guid.NewGuid(),
                Slug = "pricing-v2",
                LayerId = layer.Id.ToString("D"),
                AssignmentUnitSelector = layer.AssignmentUnitSelector,
                SliceStart = 10,
                SliceEnd = 40,
                Status = "collecting"
            }
        };
        var layerService = new Mock<IExperimentLayerService>();
        layerService
            .Setup(service => service.GetListAsync(envId, filter))
            .ReturnsAsync(page);
        var experimentService = new Mock<IExperimentService>();
        experimentService
            .Setup(service => service.GetExperimentRunsByLayersAsync(envId, page.Items))
            .ReturnsAsync([run]);
        var handler = new GetExperimentLayersHandler(
            layerService.Object,
            experimentService.Object,
            CreateMapper());

        var result = await handler.Handle(
            new GetExperimentLayerList { EnvId = envId, Filter = filter },
            CancellationToken.None);

        Assert.Equal(11, result.TotalCount);
        var item = Assert.Single(result.Items);
        Assert.Equal(layer.Id, item.Id);
        var mappedRun = Assert.Single(item.ExperimentRuns);
        Assert.Equal(run.Run.Id, mappedRun.Id);
        Assert.Equal("Checkout pricing", mappedRun.ExperimentName);
        Assert.Equal(30, item.AllocationSummary.ReservedPercent);
        Assert.Equal(70, item.AllocationSummary.FreePercent);
        Assert.Equal("no-conflicts", item.AllocationSummary.Status);
        experimentService.Verify(
            service => service.GetExperimentRunsByLayersAsync(envId, page.Items),
            Times.Once);
    }

    [Fact]
    public async Task Handle_EmptyPage_DoesNotQueryExperimentRuns()
    {
        var envId = Guid.NewGuid();
        var filter = new ExperimentLayerFilter();
        var layerService = new Mock<IExperimentLayerService>();
        layerService
            .Setup(service => service.GetListAsync(envId, filter))
            .ReturnsAsync(new PagedResult<ExperimentLayer>(0, []));
        var experimentService = new Mock<IExperimentService>(MockBehavior.Strict);
        var handler = new GetExperimentLayersHandler(
            layerService.Object,
            experimentService.Object,
            CreateMapper());

        var result = await handler.Handle(
            new GetExperimentLayerList { EnvId = envId, Filter = filter },
            CancellationToken.None);

        Assert.Empty(result.Items);
        Assert.Equal(0, result.TotalCount);
    }

    private static ExperimentLayer NewLayer(Guid envId) => new()
    {
        Id = Guid.NewGuid(),
        FeatBitEnvId = envId,
        Name = "Checkout",
        Key = "checkout",
        Description = "Checkout experiments",
        AssignmentUnitSelector = "user.keyId",
        Status = "active"
    };

    private static IMapper CreateMapper()
    {
        var configuration = new MapperConfiguration(
            config => config.AddProfile<Application.Experiments.ExperimentLayers.MapperProfile>());
        configuration.AssertConfigurationIsValid();
        return configuration.CreateMapper();
    }
}
