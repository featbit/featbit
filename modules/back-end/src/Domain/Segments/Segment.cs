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

    public bool IsEnvironmentSpecific => Type == SegmentType.EnvironmentSpecific;

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
}