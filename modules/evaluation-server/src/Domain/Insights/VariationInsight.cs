#nullable disable

using System.Text.RegularExpressions;
using Domain.Evaluation;

namespace Domain.Insights;

public partial class VariationInsight
{
    // see also: modules/back-end/src/Domain/FeatureFlags/FeatureFlag.cs#L9
    [GeneratedRegex("^[a-zA-Z0-9._-]+$")]
    private static partial Regex KeyRegex();

    public string FeatureFlagKey { get; set; }

    public Variation Variation { get; set; }

    public bool SendToExperiment { get; set; }

    public long Timestamp { get; set; }

    public bool IsValid()
    {
        if (string.IsNullOrWhiteSpace(FeatureFlagKey) || !KeyRegex().IsMatch(FeatureFlagKey))
        {
            return false;
        }

        if (!Variation.IsValid())
        {
            return false;
        }

        return true;
    }
}