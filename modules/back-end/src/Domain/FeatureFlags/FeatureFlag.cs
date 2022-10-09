using Domain.Targeting;
using Domain.Utils;

namespace Domain.FeatureFlags;

public class FeatureFlag : FullAuditedEntity
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string VariationType { get; set; }

    public ICollection<Variation> Variations { get; set; }

    public ICollection<TargetUser> TargetUsers { get; set; }

    public ICollection<TargetRule> Rules { get; set; }

    public bool IsEnabled { get; set; }

    public string DisabledVariationId { get; set; }

    public Fallthrough Fallthrough { get; set; }

    public bool ExptIncludeAllTargets { get; set; }

    public bool IsArchived { get; set; }

    public FeatureFlag(Guid envId, string name, Guid currentUserId) : base(currentUserId)
    {
        EnvId = envId;

        Name = name;
        Key = name.Replace(new[] { ' ', '.', ':', '_', '\'', '/', '\\' }, '-');

        var falsyVariationId = Guid.NewGuid().ToString();
        var truthyVariationId = Guid.NewGuid().ToString();
        VariationType = "boolean";
        Variations = new List<Variation>
        {
            new(truthyVariationId, "true"),
            new(falsyVariationId, "false")
        };

        TargetUsers = Array.Empty<TargetUser>();
        Rules = Array.Empty<TargetRule>();

        IsEnabled = false;
        DisabledVariationId = falsyVariationId;
        Fallthrough = new Fallthrough
        {
            IncludedInExpt = true,
            Variations = new List<RolloutVariation>
            {
                new()
                {
                    Id = truthyVariationId,
                    Rollout = new double[] { 0, 1 },
                    ExptRollout = 1
                }
            }
        };
        ExptIncludeAllTargets = true;

        IsArchived = false;
    }

    public Serves Serves()
    {
        // variations when enabled
        var targeted = TargetUsers
            .Where(x => x.KeyIds.Any())
            .Select(y => y.VariationId);

        var rules = Rules
            .SelectMany(x => x.Variations)
            .Where(y => !y.IsEmpty())
            .Select(x => x.Id);

        var fallthrough = Fallthrough.Variations
            .Where(x => !x.IsEmpty())
            .Select(x => x.Id);

        var variationIds = targeted.Concat(rules).Concat(fallthrough).Distinct();
        var enabledVariations = Variations
            .Where(x => variationIds.Contains(x.Id))
            .Select(x => x.Value);

        // variations when disabled
        var disabledVariation = Variations.First(x => x.Id == DisabledVariationId).Value;

        var serves = new Serves
        {
            EnabledVariations = enabledVariations,
            DisabledVariation = disabledVariation
        };
        return serves;
    }

    public void Archive(Guid currentUserId)
    {
        IsArchived = true;

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;
    }
}