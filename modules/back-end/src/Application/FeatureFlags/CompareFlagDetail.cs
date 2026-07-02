using Domain.FeatureFlags;
using Domain.Segments;

namespace Application.FeatureFlags;

public class CompareFlagDetail
{
    public FeatureFlag Source { get; set; }

    public FeatureFlag Target { get; set; }

    public FlagDiff Diff { get; set; }

    public ICollection<KeyValuePair<string, string>> RelatedSegments { get; }

    public bool IsRulesCopyable { get; set; }

    public CompareFlagDetail(
        FeatureFlag source,
        FeatureFlag target,
        ICollection<Segment> relatedSegments,
        string targetEnvRN)
    {
        Source = source;
        Target = target;

        Diff = FlagDiffer.Diff(source, target, relatedSegments);

        RelatedSegments = relatedSegments
            .Select(segment => new KeyValuePair<string, string>(segment.Id.ToString(), segment.Name))
            .ToArray();

        IsRulesCopyable = FlagCopyHelper.IsRulesCopyable(source.Rules, relatedSegments, targetEnvRN);
    }
}