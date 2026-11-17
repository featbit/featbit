using Domain.Experiments;

namespace Application.Experiments.ExperimentMetrics;

public static class ExperimentMetricReadModel
{
    public static IReadOnlyCollection<Guid> GetReferencedIds(ExperimentWithRuns experimentWithRuns)
    {
        ArgumentNullException.ThrowIfNull(experimentWithRuns);
        var ids = new HashSet<Guid>();
        Add(ids, experimentWithRuns.Experiment.PrimaryMetric);
        foreach (var metric in experimentWithRuns.Experiment.GuardrailMetrics)
        {
            Add(ids, metric);
        }

        foreach (var run in experimentWithRuns.Runs)
        {
            Add(ids, run.PrimaryMetric);
            foreach (var metric in run.GuardrailMetrics)
            {
                Add(ids, metric);
            }
        }

        return ids.ToArray();
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
            if (Matches(run.PrimaryMetric, metric))
            {
                runs.Add(ToRun(run, "primary"));
            }
            else if (run.GuardrailMetrics.Any(snapshot => Matches(snapshot, metric)))
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
            ExperimentName = experimentWithRuns.Experiment.Name,
            Runs = runs
        };
    }

    private static ExperimentMetricRunVm ToRun(ExperimentRun run, string role)
    {
        return new ExperimentMetricRunVm
        {
            Id = run.Id,
            Key = Normalize(run.Slug) ?? run.Id.ToString("D"),
            Role = role
        };
    }

    private static bool Matches(MetricConfig snapshot, ExperimentMetric metric) =>
        snapshot is not null && snapshot.MetricId == metric.Id;

    private static void Add(ISet<Guid> ids, MetricConfig snapshot)
    {
        if (snapshot is not null)
        {
            ids.Add(snapshot.MetricId);
        }
    }

    private static string Normalize(string value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
