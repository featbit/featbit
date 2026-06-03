namespace Application.ExperimentStats;

public class ExperimentStatsVm
{
    public Guid EnvId { get; set; }
    public string FlagKey { get; set; }
    public string MetricEvent { get; set; }
    public ExperimentStatsWindowVm Window { get; set; }
    public IEnumerable<ExperimentVariantStatsVm> Variants { get; set; }
}

public class ExperimentStatsWindowVm
{
    public string Start { get; set; }
    public string End { get; set; }
}

public class ExperimentVariantStatsVm
{
    public string Variant { get; set; }
    public long Users { get; set; }
    public long Conversions { get; set; }
    public double SumValue { get; set; }
    public double SumSquares { get; set; }
    public double ConversionRate { get; set; }
    public double AvgValue { get; set; }
}
