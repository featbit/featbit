using Domain.AuditLogs;
using Domain.FlagDrafts;
using Domain.Targeting;

namespace Domain.FeatureFlags;

public class FeatureFlag : FullAuditedEntity
{
    public const string KeyPattern = "^[a-zA-Z0-9._-]+$";

    public Guid EnvId { get; set; }

    public Guid Revision { get; set; }

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

    public string[] Tags { get; set; }

    public bool IsArchived { get; set; }

    /// <summary>
    /// Monotonic version of the last COMMITTED change to this flag. The committed
    /// value is the authoritative value that may be safely served to evaluators.
    /// </summary>
    public long CommittedVersion { get; set; }

    /// <summary>
    /// A staged-but-not-committed change. Null when there is no pending change
    /// (the default). When set, the committed read must continue to return the
    /// committed value and ignore this pending change until it is promoted.
    /// </summary>
    public PendingFlagChange Pending { get; set; }

    public FeatureFlag()
    {
    }

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
        string[] tags,
        Guid currentUserId) : base(currentUserId)
    {
        Revision = Guid.NewGuid();

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
                    Rollout = [0, 1],
                    ExptRollout = 1
                }
            }
        };
        ExptIncludeAllTargets = true;

        Tags = tags ?? [];
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
        MarkAsUpdated(currentUserId);

        return dataChange.To(this);
    }

    public DataChange Restore(Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        IsArchived = false;
        MarkAsUpdated(currentUserId);

        return dataChange.To(this);
    }

    public DataChange UpdateName(string name, Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        Name = name;
        MarkAsUpdated(currentUserId);

        return dataChange.To(this);
    }

    public DataChange UpdateDescription(string description, Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        Description = description;
        MarkAsUpdated(currentUserId);

        return dataChange.To(this);
    }

    public DataChange UpdateOffVariation(string offVariationId, Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        DisabledVariationId = offVariationId;
        MarkAsUpdated(currentUserId);

        return dataChange.To(this);
    }

    public DataChange UpdateSetting(string name, string description, bool isEnabled, string disabledVariationId, Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        Name = name;
        Description = description;
        IsEnabled = isEnabled;
        DisabledVariationId = disabledVariationId;
        MarkAsUpdated(currentUserId);

        return dataChange.To(this);
    }

    public DataChange UpdateVariations(ICollection<Variation> variations, Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        Variations = variations;
        MarkAsUpdated(currentUserId);

        return dataChange.To(this);
    }

    public DataChange UpdateTargeting(FlagTargeting targeting, Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        TargetUsers = targeting.TargetUsers;
        Rules = targeting.Rules;
        Fallthrough = targeting.Fallthrough;
        ExptIncludeAllTargets = targeting.ExptIncludeAllTargets;
        MarkAsUpdated(currentUserId);

        return dataChange.To(this);
    }

    public void CopyToEnv(Guid targetEnvId, Guid currentUserId, bool keepRules = false)
    {
        // clear id
        Id = Guid.Empty;

        // change envId
        EnvId = targetEnvId;

        // clear targeting-users
        TargetUsers = Array.Empty<TargetUser>();

        if (!keepRules)
        {
            Rules = Array.Empty<TargetRule>();
        }

        // change audited properties
        CreatedAt = DateTime.UtcNow;
        CreatorId = currentUserId;
        MarkAsUpdated(currentUserId);
    }

    public DataChange CopySettingsFrom(FlagCopyContext context, Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        FlagCopyHelper.CopySettings(context);
        MarkAsUpdated(currentUserId);

        dataChange.To(this);

        return dataChange;
    }

    public FeatureFlag Clone(string name, string key, string description, string[] tags, Guid currentUserId)
    {
        // clear id
        Id = Guid.Empty;

        Name = name;
        Key = key;
        Description = description;
        Tags = tags ?? [];

        // change audited properties
        CreatedAt = DateTime.UtcNow;
        CreatorId = currentUserId;
        MarkAsUpdated(currentUserId);

        return this;
    }

    public DataChange Toggle(Guid currentUserId, bool status)
    {
        var dataChange = new DataChange(this);

        IsEnabled = status;
        MarkAsUpdated(currentUserId);

        return dataChange.To(this);
    }

    public Variation GetVariation(string variationId)
    {
        return Variations.FirstOrDefault(x => x.Id == variationId);
    }

    public DataChange SetTags(string[] tags, Guid currentUserId)
    {
        var dataChange = new DataChange(this);

        Tags = tags ?? [];
        MarkAsUpdated(currentUserId);

        return dataChange.To(this);
    }

    public DataChange ApplyDraft(FlagDraft draft)
    {
        var dataChange = new DataChange(this);

        var instructions = draft.GetInstructions();
        foreach (var instruction in instructions)
        {
            instruction.Apply(this);
        }
        MarkAsUpdated(draft.CreatorId);

        return dataChange.To(this);
    }

    /// <summary>
    /// Mark the feature flag as updated when a referenced segment's targeting is updated.
    /// </summary>
    /// <param name="operatorId">The ID of the operator making the change to the segment.</param>
    public void ReferencedSegmentTargetingUpdated(Guid operatorId) => base.MarkAsUpdated(operatorId);

    public override void MarkAsUpdated(Guid updatorId)
    {
        Revision = Guid.NewGuid();

        base.MarkAsUpdated(updatorId);
    }

    /// <summary>
    /// Stage <paramref name="pendingValue"/> as a pending (not-yet-committed) change.
    /// The committed value is left untouched, so a committed read still returns the
    /// old value until <see cref="PromotePending"/> is called.
    /// </summary>
    public void SetPending(FeatureFlag pendingValue, long version)
    {
        // A pending value must never itself carry a pending change (no pending-within-pending):
        // the staged payload describes a single committed-to-be state, so null out any nested
        // pending before storing it. This keeps the staged document flat and avoids recursive bloat.
        if (pendingValue != null)
        {
            pendingValue.Pending = null;
        }

        Pending = new PendingFlagChange
        {
            Version = version,
            Value = pendingValue
        };
    }

    /// <summary>
    /// Promote the staged pending change to committed: the pending value becomes the
    /// committed value, <see cref="CommittedVersion"/> advances to the pending version,
    /// and the pending slot is cleared. No-op when there is no pending change.
    /// </summary>
    public void PromotePending()
    {
        if (Pending == null)
        {
            return;
        }

        var promoted = Pending.Value;
        var version = Pending.Version;

        // adopt the committed-relevant fields from the pending value
        Name = promoted.Name;
        Description = promoted.Description;
        Key = promoted.Key;
        VariationType = promoted.VariationType;
        Variations = promoted.Variations;
        TargetUsers = promoted.TargetUsers;
        Rules = promoted.Rules;
        IsEnabled = promoted.IsEnabled;
        DisabledVariationId = promoted.DisabledVariationId;
        Fallthrough = promoted.Fallthrough;
        ExptIncludeAllTargets = promoted.ExptIncludeAllTargets;
        Tags = promoted.Tags;
        IsArchived = promoted.IsArchived;
        // Revision is part of the committed-relevant state (it changes on every mutation and is
        // observed by evaluators); adopt the pending value's revision on promotion.
        Revision = promoted.Revision;

        // Refresh audit fields so the committed value reflects WHEN it was promoted and WHO authored
        // the change. The promotion is the moment this value becomes authoritative, so UpdatedAt must
        // advance to now; carry the pending author's UpdatorId.
        UpdatorId = promoted.UpdatorId;
        UpdatedAt = DateTime.UtcNow;

        CommittedVersion = version;
        Pending = null;
    }
}