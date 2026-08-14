using Application.ExperimentStats;
using Application.Services;

namespace Application.IntegrationTests.Stubs;

public class TestExperimentStatsService : IExperimentStatsService
{
    public Task<ExperimentStatsVm> QueryAsync(QueryExperimentStats request)
    {
        var stats = new ExperimentStatsVm
        {
            EnvId = request.EnvId,
            FlagKey = request.FlagKey,
            MetricEvent = request.MetricEvent,
            Window = new ExperimentStatsWindowVm
            {
                Start = request.StartDate,
                End = request.EndDate
            },
            Variants =
            [
                new ExperimentVariantStatsVm
                {
                    Variant = "control",
                    Users = 100,
                    Conversions = 10,
                    SumValue = 10,
                    SumSquares = 10,
                    ConversionRate = 0.1,
                    AvgValue = 0.1
                },
                new ExperimentVariantStatsVm
                {
                    Variant = "treatment",
                    Users = 100,
                    Conversions = 15,
                    SumValue = 15,
                    SumSquares = 15,
                    ConversionRate = 0.15,
                    AvgValue = 0.15
                }
            ]
        };

        return Task.FromResult(stats);
    }
}
