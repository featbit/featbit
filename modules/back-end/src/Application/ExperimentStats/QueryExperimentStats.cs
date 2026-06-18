using Application.Bases;

namespace Application.ExperimentStats;

public class QueryExperimentStats : IRequest<ExperimentStatsVm>
{
    public Guid EnvId { get; set; }
    public string FlagKey { get; set; }
    public string MetricEvent { get; set; }
    public string StartDate { get; set; }
    public string EndDate { get; set; }
    public string MetricType { get; set; }
    public string MetricAgg { get; set; }
}

public class QueryExperimentStatsValidator : AbstractValidator<QueryExperimentStats>
{
    private static readonly string[] MetricTypes = ["binary", "continuous"];
    private static readonly string[] MetricAggs = ["once", "count", "sum", "average"];

    public QueryExperimentStatsValidator()
    {
        RuleFor(x => x.FlagKey)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("flagKey"));

        RuleFor(x => x.MetricEvent)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("metricEvent"));

        RuleFor(x => x.StartDate)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("startDate"))
            .Must(BeDateOnly).WithErrorCode(ErrorCodes.Invalid("startDate"));

        RuleFor(x => x.EndDate)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("endDate"))
            .Must(BeDateOnly).WithErrorCode(ErrorCodes.Invalid("endDate"));

        RuleFor(x => x)
            .Must(x => DateOnly.ParseExact(x.EndDate, "yyyy-MM-dd") >= DateOnly.ParseExact(x.StartDate, "yyyy-MM-dd"))
            .When(x => BeDateOnly(x.StartDate) && BeDateOnly(x.EndDate))
            .WithErrorCode(ErrorCodes.Invalid("endDate"));

        RuleFor(x => x.MetricType)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("metricType"))
            .Must(x => MetricTypes.Contains(x)).WithErrorCode(ErrorCodes.Invalid("metricType"));

        RuleFor(x => x.MetricAgg)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("metricAgg"))
            .Must(x => MetricAggs.Contains(x)).WithErrorCode(ErrorCodes.Invalid("metricAgg"));
    }

    private static bool BeDateOnly(string value)
    {
        return DateOnly.TryParseExact(value, "yyyy-MM-dd", out _);
    }
}

public class QueryExperimentStatsHandler(IExperimentStatsService service)
    : IRequestHandler<QueryExperimentStats, ExperimentStatsVm>
{
    public async Task<ExperimentStatsVm> Handle(QueryExperimentStats request, CancellationToken cancellationToken)
    {
        return await service.QueryAsync(request);
    }
}
