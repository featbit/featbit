using Application.Bases;
using Application.Bases.Models;

namespace Application.Experiments;

public class ExperimentMetricVm
{
    public Guid Id { get; set; }

    public Guid FeatBitEnvId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public string MetricType { get; set; }

    public string MetricAgg { get; set; }

    public string Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

public class ExperimentMetricFilter : PagedRequest
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string Status { get; set; }
}

public class ExperimentMetricUpdate
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public string MetricType { get; set; } = "binary";

    public string MetricAgg { get; set; } = "once";

    public string Status { get; set; } = "active";
}

public class QueryExperimentMetrics : IRequest<PagedResult<ExperimentMetricVm>>
{
    public Guid EnvId { get; set; }

    public ExperimentMetricFilter Filter { get; set; }
}

public class CreateExperimentMetric : IRequest<ExperimentMetricVm>
{
    public Guid EnvId { get; set; }

    public ExperimentMetricUpdate Update { get; set; }
}

public class UpdateExperimentMetric : IRequest<ExperimentMetricVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public ExperimentMetricUpdate Update { get; set; }
}

public class DeleteExperimentMetric : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class ExperimentMetricUpdateValidator : AbstractValidator<ExperimentMetricUpdate>
{
    private static readonly string[] MetricTypes = ["binary", "continuous", "numeric"];
    private static readonly string[] MetricAggs = ["once", "count", "sum", "average"];

    public ExperimentMetricUpdateValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"))
            .MaximumLength(256).WithErrorCode(ErrorCodes.Invalid("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"))
            .MaximumLength(128).WithErrorCode(ErrorCodes.Invalid("key"))
            .Matches("^[A-Za-z0-9][A-Za-z0-9_.:-]*$")
            .WithErrorCode(ErrorCodes.Invalid("key"));

        RuleFor(x => x.MetricType)
            .Must(value => MetricTypes.Contains(value))
            .WithErrorCode(ErrorCodes.Invalid("metricType"));

        RuleFor(x => x.MetricAgg)
            .Must(value => MetricAggs.Contains(value))
            .WithErrorCode(ErrorCodes.Invalid("metricAgg"));

        RuleFor(x => x.Status)
            .Must(x => string.IsNullOrWhiteSpace(x) || x is "active" or "archived")
            .WithErrorCode(ErrorCodes.Invalid("status"));
    }
}

public class QueryExperimentMetricsHandler(IExperimentMetricService service)
    : IRequestHandler<QueryExperimentMetrics, PagedResult<ExperimentMetricVm>>
{
    public async Task<PagedResult<ExperimentMetricVm>> Handle(
        QueryExperimentMetrics request,
        CancellationToken cancellationToken)
    {
        return await service.GetListAsync(request.EnvId, request.Filter);
    }
}

public class CreateExperimentMetricHandler(IExperimentMetricService service)
    : IRequestHandler<CreateExperimentMetric, ExperimentMetricVm>
{
    public async Task<ExperimentMetricVm> Handle(
        CreateExperimentMetric request,
        CancellationToken cancellationToken)
    {
        return await service.CreateAsync(request.EnvId, request.Update);
    }
}

public class UpdateExperimentMetricHandler(IExperimentMetricService service)
    : IRequestHandler<UpdateExperimentMetric, ExperimentMetricVm>
{
    public async Task<ExperimentMetricVm> Handle(
        UpdateExperimentMetric request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateAsync(request.EnvId, request.Id, request.Update);
    }
}

public class DeleteExperimentMetricHandler(IExperimentMetricService service)
    : IRequestHandler<DeleteExperimentMetric, bool>
{
    public async Task<bool> Handle(DeleteExperimentMetric request, CancellationToken cancellationToken)
    {
        await service.ArchiveAsync(request.EnvId, request.Id);
        return true;
    }
}
