using Application.Bases;
using Application.Bases.Models;

namespace Application.ReleaseDecisions;

public class ReleaseDecisionMetricVm
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

public class ReleaseDecisionMetricFilter : PagedRequest
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string Status { get; set; }
}

public class ReleaseDecisionMetricUpdate
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public string MetricType { get; set; } = "binary";

    public string MetricAgg { get; set; } = "once";

    public string Status { get; set; } = "active";
}

public class QueryReleaseDecisionMetrics : IRequest<PagedResult<ReleaseDecisionMetricVm>>
{
    public Guid EnvId { get; set; }

    public ReleaseDecisionMetricFilter Filter { get; set; }
}

public class CreateReleaseDecisionMetric : IRequest<ReleaseDecisionMetricVm>
{
    public Guid EnvId { get; set; }

    public ReleaseDecisionMetricUpdate Update { get; set; }
}

public class UpdateReleaseDecisionMetric : IRequest<ReleaseDecisionMetricVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public ReleaseDecisionMetricUpdate Update { get; set; }
}

public class DeleteReleaseDecisionMetric : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class ReleaseDecisionMetricUpdateValidator : AbstractValidator<ReleaseDecisionMetricUpdate>
{
    private static readonly string[] MetricTypes = ["binary", "continuous", "numeric"];
    private static readonly string[] MetricAggs = ["once", "count", "sum", "average"];

    public ReleaseDecisionMetricUpdateValidator()
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

public class QueryReleaseDecisionMetricsHandler(IReleaseDecisionMetricService service)
    : IRequestHandler<QueryReleaseDecisionMetrics, PagedResult<ReleaseDecisionMetricVm>>
{
    public async Task<PagedResult<ReleaseDecisionMetricVm>> Handle(
        QueryReleaseDecisionMetrics request,
        CancellationToken cancellationToken)
    {
        return await service.GetListAsync(request.EnvId, request.Filter);
    }
}

public class CreateReleaseDecisionMetricHandler(IReleaseDecisionMetricService service)
    : IRequestHandler<CreateReleaseDecisionMetric, ReleaseDecisionMetricVm>
{
    public async Task<ReleaseDecisionMetricVm> Handle(
        CreateReleaseDecisionMetric request,
        CancellationToken cancellationToken)
    {
        return await service.CreateAsync(request.EnvId, request.Update);
    }
}

public class UpdateReleaseDecisionMetricHandler(IReleaseDecisionMetricService service)
    : IRequestHandler<UpdateReleaseDecisionMetric, ReleaseDecisionMetricVm>
{
    public async Task<ReleaseDecisionMetricVm> Handle(
        UpdateReleaseDecisionMetric request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateAsync(request.EnvId, request.Id, request.Update);
    }
}

public class DeleteReleaseDecisionMetricHandler(IReleaseDecisionMetricService service)
    : IRequestHandler<DeleteReleaseDecisionMetric, bool>
{
    public async Task<bool> Handle(DeleteReleaseDecisionMetric request, CancellationToken cancellationToken)
    {
        await service.ArchiveAsync(request.EnvId, request.Id);
        return true;
    }
}
