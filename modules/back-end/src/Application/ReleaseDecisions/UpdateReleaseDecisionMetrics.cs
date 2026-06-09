using System.Text.Json;
using Application.Bases;

namespace Application.ReleaseDecisions;

public class ReleaseDecisionMetricsUpdate
{
    public string MetricName { get; set; }

    public string MetricEvent { get; set; }

    public string MetricType { get; set; } = "binary";

    public string MetricAgg { get; set; } = "once";

    public string MetricDescription { get; set; }

    public string Guardrails { get; set; }
}

public class UpdateReleaseDecisionMetrics : IRequest<ReleaseDecisionExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public ReleaseDecisionMetricsUpdate Update { get; set; }
}

public class UpdateReleaseDecisionMetricsValidator : AbstractValidator<UpdateReleaseDecisionMetrics>
{
    private static readonly string[] MetricTypes = ["binary", "continuous", "numeric"];
    private static readonly string[] MetricAggs = ["once", "count", "sum", "average"];

    public UpdateReleaseDecisionMetricsValidator()
    {
        RuleFor(x => x.Update)
            .NotNull().WithErrorCode(ErrorCodes.Required("update"));

        When(x => x.Update != null, () =>
        {
            RuleFor(x => x.Update.MetricName)
                .Must(value => !string.IsNullOrWhiteSpace(value))
                .WithErrorCode(ErrorCodes.Required("metricName"));

            RuleFor(x => x.Update.MetricName)
                .MaximumLength(80)
                .WithErrorCode(ErrorCodes.Invalid("metricName"))
                .WithMessage("Metric name must be 80 characters or fewer.");

            RuleFor(x => x.Update.MetricEvent)
                .Must(value => !string.IsNullOrWhiteSpace(value))
                .WithErrorCode(ErrorCodes.Required("metricEvent"));

            RuleFor(x => x.Update.MetricEvent)
                .MaximumLength(128)
                .WithErrorCode(ErrorCodes.Invalid("metricEvent"))
                .WithMessage("Metric event key must be 128 characters or fewer.");

            RuleFor(x => x.Update.MetricEvent)
                .Matches("^[A-Za-z0-9][A-Za-z0-9_.:-]*$")
                .WithErrorCode(ErrorCodes.Invalid("metricEvent"))
                .WithMessage("Metric event key must not contain spaces.");

            RuleFor(x => x.Update.MetricType)
                .Must(value => MetricTypes.Contains(value))
                .WithErrorCode(ErrorCodes.Invalid("metricType"));

            RuleFor(x => x.Update.MetricAgg)
                .Must(value => MetricAggs.Contains(value))
                .WithErrorCode(ErrorCodes.Invalid("metricAgg"));

            RuleFor(x => x.Update.Guardrails)
                .Must(BeValidGuardrails)
                .WithErrorCode(ErrorCodes.Invalid("guardrails"))
                .WithMessage(
                    "Guardrails must be a JSON array. Each guardrail requires event, metricType, metricAgg, and alarm direction.");
        });
    }

    private static bool BeValidGuardrails(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        try
        {
            using var doc = JsonDocument.Parse(value);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            foreach (var item in doc.RootElement.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object)
                {
                    return false;
                }

                if (string.IsNullOrWhiteSpace(GetJsonString(item, "event")))
                {
                    return false;
                }

                if (!MetricTypes.Contains(GetJsonString(item, "metricType")))
                {
                    return false;
                }

                if (!MetricAggs.Contains(GetJsonString(item, "metricAgg")))
                {
                    return false;
                }

                if (!HasAlarmDirection(item))
                {
                    return false;
                }
            }

            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool HasAlarmDirection(JsonElement item)
    {
        if (item.TryGetProperty("inverse", out var inverse) &&
            inverse.ValueKind is JsonValueKind.True or JsonValueKind.False)
        {
            return true;
        }

        var direction = GetJsonString(item, "direction");
        return direction is "increase_bad" or "decrease_bad";
    }

    private static string GetJsonString(JsonElement item, string property)
    {
        return item.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }
}

public class UpdateReleaseDecisionMetricsHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<UpdateReleaseDecisionMetrics, ReleaseDecisionExperimentDetailVm>
{
    public async Task<ReleaseDecisionExperimentDetailVm> Handle(
        UpdateReleaseDecisionMetrics request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateMetricsAsync(request.EnvId, request.Id, request.Update);
    }
}
