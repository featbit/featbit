namespace Domain.Experiments;

public class ExperimentExposureEvent : Entity
{
    public Guid EnvId { get; set; }

    public string FlagKey { get; set; }

    public string UserKey { get; set; }

    public string VariationId { get; set; }

    public string VariationValue { get; set; }

    public DateTime ExposedAt { get; set; }

    public string Properties { get; set; }

    public DateTime CreatedAt { get; set; }
}
