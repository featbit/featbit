using Domain.Targeting;

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
        VariationType = VariationTypes.Boolean;
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

    public void UnArchive(Guid currentUserId)
    {
        IsArchived = false;

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;
    }

    public void UpdateSetting(string name, bool isEnabled, string disabledVariationId, Guid currentUserId)
    {
        Name = name;
        IsEnabled = isEnabled;
        DisabledVariationId = disabledVariationId;

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;
    }

    public void UpdateVariations(string variationType, ICollection<Variation> variations, Guid currentUserId)
    {
        VariationType = variationType;
        Variations = variations;

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;
    }

    public void UpdateTargeting(
        ICollection<TargetUser> targetUsers,
        ICollection<TargetRule> rules,
        Fallthrough fallthrough,
        bool exptIncludeAllTargets,
        Guid currentUserId)
    {
        TargetUsers = targetUsers;
        Rules = rules;
        Fallthrough = fallthrough;
        ExptIncludeAllTargets = exptIncludeAllTargets;

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;
    }

    public void CopyToEnv(Guid targetEnvId, Guid currentUserId)
    {
        // clear id
        Id = Guid.Empty;

        // change envId
        EnvId = targetEnvId;

        // clear targeting
        TargetUsers = Array.Empty<TargetUser>();
        Rules = Array.Empty<TargetRule>();

        // change audited properties
        CreatedAt = DateTime.UtcNow;
        CreatorId = currentUserId;
        UpdatedAt = CreatedAt;
        UpdatorId = currentUserId;
    }

    public void Toggle(Guid currentUserId)
    {
        IsEnabled = !IsEnabled;

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;
    }

    public Variation DisabledVariation => GetVariation(DisabledVariationId);

    public Variation GetVariation(string variationId)
    {
        return Variations.FirstOrDefault(x => x.Id == variationId);
    }
}