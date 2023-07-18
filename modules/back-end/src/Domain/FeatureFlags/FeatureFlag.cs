using Domain.AuditLogs;
using Domain.Targeting;

namespace Domain.FeatureFlags;

public class FeatureFlag : FullAuditedEntity
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public string Key { get; set; }

    public string VariationType { get; set; }

    public ICollection<Variation> Variations { get; set; }

    public ICollection<TargetUser> TargetUsers { get; set; }

    public ICollection<TargetRule> Rules { get; set; }

    public bool IsEnabled { get; set; }

    public string DisabledVariationId { get; set; }

    public Fallthrough Fallthrough { get; set; }

    public bool ExptIncludeAllTargets { get; set; }

    public ICollection<string> Tags { get; set; }

    public bool IsArchived { get; set; }

    public FeatureFlag(
        Guid envId,
        string name,
        string description,
        string key,
        bool isEnabled,
        string variationType,
        ICollection<Variation> variations,
        string disabledVariationId,
        string enabledVariationId,
        ICollection<string> tags,
        Guid currentUserId) : base(currentUserId)
    {
        EnvId = envId;

        Name = name;
        Description = description;
        Key = key;

        VariationType = variationType;
        Variations = variations;

        TargetUsers = Array.Empty<TargetUser>();
        Rules = Array.Empty<TargetRule>();

        IsEnabled = isEnabled;
        DisabledVariationId = disabledVariationId;
        Fallthrough = new Fallthrough
        {
            IncludedInExpt = true,
            Variations = new List<RolloutVariation>
            {
                new()
                {
                    Id = enabledVariationId,
                    Rollout = new double[] { 0, 1 },
                    ExptRollout = 1
                }
            }
        };
        ExptIncludeAllTargets = true;

        Tags = tags ?? Array.Empty<string>();
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

    public DataChange Archive(Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        IsArchived = true;

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;

        return dataChange.To(this);
    }

    public DataChange Restore(Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        IsArchived = false;

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;

        return dataChange.To(this);
    }

    public DataChange UpdateSetting(string name, string description, bool isEnabled, string disabledVariationId, Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        Name = name;
        Description = description;
        IsEnabled = isEnabled;
        DisabledVariationId = disabledVariationId;

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;

        return dataChange.To(this);
    }

    public DataChange UpdateVariations(ICollection<Variation> variations, Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        Variations = variations;

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;

        return dataChange.To(this);
    }

    public DataChange UpdateTargeting(
        ICollection<TargetUser> targetUsers,
        ICollection<TargetRule> rules,
        Fallthrough fallthrough,
        bool exptIncludeAllTargets,
        Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        TargetUsers = targetUsers;
        Rules = rules;
        Fallthrough = fallthrough;
        ExptIncludeAllTargets = exptIncludeAllTargets;

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;

        return dataChange.To(this);
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

    public DataChange Toggle(Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        IsEnabled = !IsEnabled;

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;

        return dataChange.To(this);
    }

    public Variation DisabledVariation => GetVariation(DisabledVariationId);

    public Variation GetVariation(string variationId)
    {
        return Variations.FirstOrDefault(x => x.Id == variationId);
    }

    public DataChange SetTags(ICollection<string> tags, Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        Tags = tags ?? Array.Empty<string>();

        UpdatedAt = DateTime.UtcNow;
        UpdatorId = currentUserId;

        return dataChange.To(this);
    }
}