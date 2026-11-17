using Service = Infrastructure.Services.MongoDb.ExperimentService;

namespace Infrastructure.UnitTests.Services.MongoDb;

public class ExperimentServiceTests : ExperimentServiceTestsBase
{
    protected override Dictionary<string, object?>? ComputeMetricSection(
        string label, Dictionary<string, object> metricData, string control,
        string[] treatments, bool isGuardrail, Prior? prior, string? metricAgg) =>
        Service.ComputeMetricSection(label, metricData, control, treatments, isGuardrail,
            prior is null ? null : new Service.GaussianPrior(prior.Mean, prior.Variance, prior.Proper), metricAgg);
}
