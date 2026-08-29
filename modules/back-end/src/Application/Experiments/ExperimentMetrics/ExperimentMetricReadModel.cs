using System.Text.Json;
using Domain.Experiments;

namespace Application.Experiments.ExperimentMetrics;

public static class ExperimentMetricReadModel
{
    public static IReadOnlyCollection<string> GetReferencedKeys(ExperimentWithRuns experimentWithRuns)
    {
        ArgumentNullException.ThrowIfNull(experimentWithRuns);
        var keys = new HashSet<string>(StringComparer.Ordinal);
        Add(keys, ReadMetricKey(experimentWithRuns.Experiment.PrimaryMetric));
        AddRange(keys, ReadMetricKeys(experimentWithRuns.Experiment.Guardrails));

        foreach (var run in experimentWithRuns.Runs)
        {
            Add(keys, Normalize(run.PrimaryMetricEvent));
            AddRange(keys, ReadMetricKeys(run.GuardrailEvents));
        }

        return keys.ToArray();
    }

    public static ExperimentMetricUsageVm Build(
        ExperimentMetric metric,
        ExperimentWithRuns experimentWithRuns)
    {
        ArgumentNullException.ThrowIfNull(metric);
        ArgumentNullException.ThrowIfNull(experimentWithRuns);

        var runs = new List<ExperimentMetricRunVm>();
        foreach (var run in experimentWithRuns.Runs.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id))
        {
            if (string.Equals(Normalize(run.PrimaryMetricEvent), metric.Key, StringComparison.Ordinal))
            {
                runs.Add(ToRun(run, "primary"));
            }
            else if (ReadMetricKeys(run.GuardrailEvents).Contains(metric.Key, StringComparer.Ordinal))
            {
                runs.Add(ToRun(run, "guardrail"));
            }
        }

        if (runs.Count == 0)
        {
            return null;
        }

        return new ExperimentMetricUsageVm
        {
            ExperimentId = experimentWithRuns.Experiment.Id,
            ExperimentName = Normalize(experimentWithRuns.Experiment.Name) ?? "Experiment",
            Runs = runs
        };
    }

    private static ExperimentMetricRunVm ToRun(ExperimentRun run, string role)
    {
        return new ExperimentMetricRunVm
        {
            Id = run.Id,
            Key = Normalize(run.Slug, run.RunId) ?? run.Id.ToString("D"),
            Status = Normalize(run.Status) ?? "draft",
            Role = role
        };
    }

    private static string ReadMetricKey(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(raw);
            return ReadMetricKey(document.RootElement);
        }
        catch (JsonException)
        {
            return Normalize(raw);
        }
    }

    private static IReadOnlyCollection<string> ReadMetricKeys(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return [];
        }

        try
        {
            using var document = JsonDocument.Parse(raw);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                var single = ReadMetricKey(document.RootElement);
                return single == null ? [] : [single];
            }

            return document.RootElement
                .EnumerateArray()
                .Select(ReadMetricKey)
                .Where(x => x != null)
                .Distinct(StringComparer.Ordinal)
                .ToArray();
        }
        catch (JsonException)
        {
            return [Normalize(raw)];
        }
    }

    private static string ReadMetricKey(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.String)
        {
            return Normalize(element.GetString());
        }

        if (element.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        foreach (var propertyName in new[] { "metricKey", "key", "event" })
        {
            if (element.TryGetProperty(propertyName, out var property) &&
                property.ValueKind == JsonValueKind.String)
            {
                var value = Normalize(property.GetString());
                if (value != null)
                {
                    return value;
                }
            }
        }

        return null;
    }

    private static void Add(ISet<string> keys, string key)
    {
        if (key != null)
        {
            keys.Add(key);
        }
    }

    private static void AddRange(ISet<string> keys, IEnumerable<string> values)
    {
        foreach (var value in values)
        {
            Add(keys, value);
        }
    }

    private static string Normalize(string value, string fallback = null) =>
        string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
}
