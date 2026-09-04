namespace Application.Experiments.ExperimentMetrics;

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

    public ICollection<ExperimentMetricUsageVm> ExperimentUsage { get; set; } = [];
}

public class ExperimentMetricUsageVm
{
    public Guid ExperimentId { get; set; }

    public string ExperimentName { get; set; }

    public ICollection<ExperimentMetricRunVm> Runs { get; set; } = [];
}

public class ExperimentMetricRunVm
{
    public Guid Id { get; set; }

    public string Key { get; set; }

    public string Status { get; set; }

    public string Role { get; set; }
}
