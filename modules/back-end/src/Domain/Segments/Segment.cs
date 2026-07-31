using System.Text.Json;
using System.Text.Json.Nodes;
using Domain.AuditLogs;
using Domain.EndUsers;
using Domain.Targeting;

namespace Domain.Segments;

public class Segment : AuditedEntity
{
    public const string KeyPattern = "^[a-zA-Z0-9._-]+$";

    public Guid WorkspaceId { get; set; }

    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Type { get; set; }

    public string[] Scopes { get; set; }

    public string Description { get; set; }

    public string[] Included { get; set; }

    public string[] Excluded { get; set; }

    public ICollection<MatchRule> Rules { get; set; }

    public string[] Tags { get; set; }

    public bool IsArchived { get; set; }

    /// <summary>
    /// Monotonic version of the last COMMITTED change to this segment. The committed
    /// value is the authoritative value that may be safely served to evaluators.
    /// </summary>
    public long CommittedVersion { get; set; }

    /// <summary>
    /// A staged-but-not-committed change. Null when there is no pending change
    /// (the default). When set, the committed read must continue to return the
    /// committed value and ignore this pending change until it is promoted.
    /// </summary>
    public PendingSegmentChange Pending { get; set; }

    public bool IsEnvironmentSpecific => Type == SegmentType.EnvironmentSpecific;

    public Segment()
    {
    }

    public Segment(
        Guid workspaceId,
        Guid envId,
        string name,
        string key,
        string type,
        string[] scopes,
        string[] included,
        string[] excluded,
        ICollection<MatchRule> rules,
        string description)
    {
        WorkspaceId = workspaceId;
        EnvId = envId;
        Name = name;
        Key = key;
        Type = type;
        Scopes = scopes;
        Included = included ?? [];
        Excluded = excluded ?? [];
        Rules = rules;
        Description = description ?? string.Empty;

        CreatedAt = DateTime.UtcNow;
        IsArchived = false;
        Tags = [];
    }

    public DataChange UpdateName(string name)
    {
        var dataChange = new DataChange(this);

        Name = name;
        UpdatedAt = DateTime.UtcNow;

        return dataChange.To(this);
    }

    public DataChange UpdateDescription(string description)
    {
        var dataChange = new DataChange(this);

        Description = description;
        UpdatedAt = DateTime.UtcNow;

        return dataChange.To(this);
    }

    public DataChange UpdateTargeting(
        string[] included,
        string[] excluded,
        ICollection<MatchRule> rules)
    {
        var dataChange = new DataChange(this);

        Included = included ?? [];
        Excluded = excluded ?? [];
        Rules = rules;

        UpdatedAt = DateTime.UtcNow;

        return dataChange.To(this);
    }

    public DataChange SetTags(string[] tags)
    {
        var dataChange = new DataChange(this);

        Tags = tags ?? [];
        UpdatedAt = DateTime.UtcNow;

        return dataChange.To(this);
    }

    public DataChange Archive()
    {
        var dataChange = new DataChange(this);

        IsArchived = true;
        UpdatedAt = DateTime.UtcNow;

        return dataChange.To(this);
    }

    public DataChange Restore()
    {
        var dataChange = new DataChange(this);

        IsArchived = false;
        UpdatedAt = DateTime.UtcNow;

        return dataChange.To(this);
    }

    public bool IsMatch(EndUser user)
    {
        if (Excluded.Contains(user.KeyId))
        {
            return false;
        }

        if (Included.Contains(user.KeyId))
        {
            return true;
        }

        // if any rule match this user
        return Rules.Any(
            rule => rule.Conditions.All(condition => condition.IsMatch(user))
        );
    }

    public JsonObject SerializeAsEnvironmentSpecific(Guid? envId = null)
    {
        var json = JsonSerializer.SerializeToNode(this, ReusableJsonSerializerOptions.Web)!.AsObject();

        json["envId"] = Type == SegmentType.EnvironmentSpecific
            ? EnvId.ToString()
            : envId?.ToString() ?? string.Empty;

        json.Remove("type");
        json.Remove("workspaceId");
        json.Remove("scopes");
        json.Remove("isEnvironmentSpecific");

        return json;
    }

    public void MarkAsUpdated(Guid updatorId)
    {
        // We may change segment to `FullAuditedEntity` in the future, so keep unused `updatorId` parameter for now.
        _ = updatorId;

        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Stage <paramref name="pendingValue"/> as a pending (not-yet-committed) change.
    /// The committed value is left untouched, so a committed read still returns the
    /// old value until <see cref="PromotePending"/> is called.
    /// </summary>
    public void SetPending(
        Segment pendingValue,
        long version,
        Guid operatorId = default,
        string operation = Operations.Update,
        bool isTargetingChange = true)
    {
        // A pending value must never itself carry a pending change (no pending-within-pending):
        // the staged payload describes a single committed-to-be state, so null out any nested
        // pending before storing it. This keeps the staged document flat and avoids recursive bloat.
        if (pendingValue != null)
        {
            pendingValue.Pending = null;
        }

        Pending = new PendingSegmentChange
        {
            Version = version,
            Value = pendingValue,
            OperatorId = operatorId,
            Operation = operation,
            IsTargetingChange = isTargetingChange
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
        Key = promoted.Key;
        Type = promoted.Type;
        Scopes = promoted.Scopes;
        Description = promoted.Description;
        Included = promoted.Included;
        Excluded = promoted.Excluded;
        Rules = promoted.Rules;
        Tags = promoted.Tags;
        IsArchived = promoted.IsArchived;

        // Refresh the audit timestamp so the committed value reflects WHEN it was promoted: the
        // promotion is the moment this value becomes authoritative. (Segment is an AuditedEntity
        // with no UpdatorId, so only UpdatedAt is carried.)
        UpdatedAt = DateTime.UtcNow;

        CommittedVersion = version;
        Pending = null;
    }
}