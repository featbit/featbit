using System.Text.Json;
using Application.Bases;

namespace Application.ReleaseDecisions;

public class ReleaseDecisionMetricsUpdate
{
    public Guid? MetricId { get; set; }

    public string MetricKey { get; set; }

    public string MetricName { get; set; }

    public string MetricEvent { get; set; }

    public string MetricType { get; set; } = "binary";

    public string MetricAgg { get; set; } = "once";

    public string ExpectedDirection { get; set; }

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
    private static readonly string[] ExpectedDirections = ["increase_good", "decrease_good"];

    public UpdateReleaseDecisionMetricsValidator()
    {
        RuleFor(x => x.Update)
            .NotNull().WithErrorCode(ErrorCodes.Required("update"));

        When(x => x.Update != null, () =>
        {
            RuleFor(x => x.Update.MetricName)
                .MaximumLength(80)
                .WithErrorCode(ErrorCodes.Invalid("metricName"))
                .WithMessage("Metric name must be 80 characters or fewer.");

            RuleFor(x => x.Update)
                .Must(HasPrimaryMetricSelector)
                .WithErrorCode(ErrorCodes.Required("metric"))
                .WithMessage("Select an existing metric by metricId, metricKey, or metricEvent.");

            RuleFor(x => x.Update.MetricEvent)
                .MaximumLength(128)
                .WithErrorCode(ErrorCodes.Invalid("metricEvent"))
                .WithMessage("Metric event key must be 128 characters or fewer.")
                .When(x => !string.IsNullOrWhiteSpace(x.Update.MetricEvent));

            RuleFor(x => x.Update.MetricEvent)
                .Matches("^[A-Za-z0-9][A-Za-z0-9_.:-]*$")
                .WithErrorCode(ErrorCodes.Invalid("metricEvent"))
                .WithMessage("Metric event key must not contain spaces.")
                .When(x => !string.IsNullOrWhiteSpace(x.Update.MetricEvent));

            RuleFor(x => x.Update.MetricKey)
                .MaximumLength(128)
                .WithErrorCode(ErrorCodes.Invalid("metricKey"))
                .WithMessage("Metric key must be 128 characters or fewer.")
                .When(x => !string.IsNullOrWhiteSpace(x.Update.MetricKey));

            RuleFor(x => x.Update.MetricKey)
                .Matches("^[A-Za-z0-9][A-Za-z0-9_.:-]*$")
                .WithErrorCode(ErrorCodes.Invalid("metricKey"))
                .WithMessage("Metric key must not contain spaces.")
                .When(x => !string.IsNullOrWhiteSpace(x.Update.MetricKey));

            RuleFor(x => x.Update.MetricType)
                .Must(value => MetricTypes.Contains(value))
                .WithErrorCode(ErrorCodes.Invalid("metricType"));

            RuleFor(x => x.Update.MetricAgg)
                .Must(value => MetricAggs.Contains(value))
                .WithErrorCode(ErrorCodes.Invalid("metricAgg"));

            RuleFor(x => x.Update.ExpectedDirection)
                .Cascade(CascadeMode.Stop)
                .Must(value => !string.IsNullOrWhiteSpace(value))
                .WithErrorCode(ErrorCodes.Required("expectedDirection"));

            RuleFor(x => x.Update.ExpectedDirection)
                .Must(value => ExpectedDirections.Contains(value))
                .WithErrorCode(ErrorCodes.Invalid("expectedDirection"))
                .WithMessage("Expected direction must be either increase_good or decrease_good.")
                .When(x => !string.IsNullOrWhiteSpace(x.Update.ExpectedDirection));

            RuleFor(x => x.Update.Guardrails)
                .Must(BeValidGuardrails)
                .WithErrorCode(ErrorCodes.Invalid("guardrails"))
                .WithMessage(
                    "Guardrails must be a JSON array. Each guardrail must select a registered metric by metricId, metricKey, key, or event.");
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

                if (!HasMetricSelector(item))
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

    private static bool HasPrimaryMetricSelector(ReleaseDecisionMetricsUpdate update)
    {
        return update.MetricId.HasValue ||
               !string.IsNullOrWhiteSpace(update.MetricKey) ||
               !string.IsNullOrWhiteSpace(update.MetricEvent);
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

    private static bool HasMetricSelector(JsonElement item)
    {
        return !string.IsNullOrWhiteSpace(GetJsonString(item, "metricId")) ||
               !string.IsNullOrWhiteSpace(GetJsonString(item, "id")) ||
               !string.IsNullOrWhiteSpace(GetJsonString(item, "metricKey")) ||
               !string.IsNullOrWhiteSpace(GetJsonString(item, "key")) ||
               !string.IsNullOrWhiteSpace(GetJsonString(item, "event"));
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
