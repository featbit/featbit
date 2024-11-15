#nullable disable

using System.ComponentModel.DataAnnotations;
using Domain.Evaluation;

namespace Domain.Insights;

public class VariationInsight
{
    [Required]
    [RegularExpression("^(?![a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)$")]
    public string FeatureFlagKey { get; set; }

    public Variation Variation { get; set; }

    public bool SendToExperiment { get; set; }

    public long Timestamp { get; set; }
}