using Application.Bases.Models;
using Application.Experiments.ExperimentMetrics;
using Application.Services;
using AutoMapper;
using Domain.Experiments;

namespace Application.UnitTests.Experiments;

public class GetExperimentMetricsHandlerTests
{
    [Fact]
    public async Task Handle_SearchesByExperimentNameAndAddsUsage()
    {
        var envId = Guid.NewGuid();
        var metric = NewMetric(envId);
        var filter = new ExperimentMetricFilter
        {
            SearchText = "Pricing",
            PageIndex = 0,
            PageSize = 10
        };
        var experimentWithRuns = new ExperimentWithRuns
        {
            Experiment = new Experiment
            {
                Id = Guid.NewGuid(),
                FeatBitEnvId = envId,
                Name = "Pricing experiment",
                PrimaryMetric = $"{{\"event\":\"{metric.Key}\"}}"
            },
            Runs =
            [
                new ExperimentRun
                {
                    Id = Guid.NewGuid(),
                    Slug = "run-1",
                    Status = "completed",
                    PrimaryMetricEvent = metric.Key
                }
            ]
        };
        var experimentService = new Mock<IExperimentService>();
        experimentService
            .Setup(service => service.GetExperimentsWithRunsAsync(envId, "Pricing"))
            .ReturnsAsync([experimentWithRuns]);
        experimentService
            .Setup(service => service.GetExperimentsWithRunsAsync(envId, null))
            .ReturnsAsync([experimentWithRuns]);
        var metricService = new Mock<IExperimentMetricService>();
        metricService
            .Setup(service => service.GetListAsync(
                envId,
                filter,
                It.Is<IReadOnlyCollection<string>>(keys => keys.SequenceEqual(new[] { metric.Key }))))
            .ReturnsAsync(new PagedResult<ExperimentMetric>(1, [metric]));
        var handler = new GetExperimentMetricsHandler(
            metricService.Object,
            experimentService.Object,
            CreateMapper());

        var result = await handler.Handle(
            new GetExperimentMetricList { EnvId = envId, Filter = filter },
            CancellationToken.None);

        Assert.Equal(1, result.TotalCount);
        var item = Assert.Single(result.Items);
        var usage = Assert.Single(item.ExperimentUsage);
        Assert.Equal("Pricing experiment", usage.ExperimentName);
        Assert.Equal("run-1", Assert.Single(usage.Runs).Key);
        experimentService.Verify(
            service => service.GetExperimentsWithRunsAsync(envId, "Pricing"),
            Times.Once);
        experimentService.Verify(
            service => service.GetExperimentsWithRunsAsync(envId, null),
            Times.Once);
    }

    [Fact]
    public async Task Handle_EmptyPageWithoutSearch_DoesNotLoadUsage()
    {
        var envId = Guid.NewGuid();
        var filter = new ExperimentMetricFilter();
        var metricService = new Mock<IExperimentMetricService>();
        metricService
            .Setup(service => service.GetListAsync(envId, filter, It.IsAny<IReadOnlyCollection<string>>()))
            .ReturnsAsync(new PagedResult<ExperimentMetric>(0, []));
        var experimentService = new Mock<IExperimentService>(MockBehavior.Strict);
        var handler = new GetExperimentMetricsHandler(
            metricService.Object,
            experimentService.Object,
            CreateMapper());

        var result = await handler.Handle(
            new GetExperimentMetricList { EnvId = envId, Filter = filter },
            CancellationToken.None);

        Assert.Empty(result.Items);
        Assert.Equal(0, result.TotalCount);
    }

    private static ExperimentMetric NewMetric(Guid envId) => new()
    {
        Id = Guid.NewGuid(),
        FeatBitEnvId = envId,
        Name = "Checkout conversion",
        Key = "checkout_completed",
        MetricType = "binary",
        MetricAgg = "once",
        Status = "active"
    };

    private static IMapper CreateMapper()
    {
        var configuration = new MapperConfiguration(
            config => config.AddProfile<Application.Experiments.ExperimentMetrics.MapperProfile>());
        configuration.AssertConfigurationIsValid();
        return configuration.CreateMapper();
    }
}
