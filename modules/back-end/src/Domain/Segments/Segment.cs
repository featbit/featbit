using Domain.AuditLogs;
using Domain.EndUsers;
using Domain.Targeting;

namespace Domain.Segments;

public class Segment : AuditedEntity
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public ICollection<string> Included { get; set; }

    public ICollection<string> Excluded { get; set; }

    public ICollection<MatchRule> Rules { get; set; }

    public bool IsArchived { get; set; }

    public Segment(
        Guid envId,
        string name,
        ICollection<string> included,
        ICollection<string> excluded,
        ICollection<MatchRule> rules,
        string description)
    {
        EnvId = envId;
        Name = name;
        Included = included ?? Array.Empty<string>();
        Excluded = excluded ?? Array.Empty<string>();
        Rules = rules;
        Description = description ?? string.Empty;

        CreatedAt = DateTime.UtcNow;
        IsArchived = false;
    }

    public DataChange Update(
        string name,
        ICollection<string> included,
        ICollection<string> excluded,
        ICollection<MatchRule> rules,
        string description)
    {
        var dataChange = new DataChange(this);

        Name = name;
        Included = included ?? Array.Empty<string>();
        Excluded = excluded ?? Array.Empty<string>();
        Rules = rules;
        Description = description ?? string.Empty;

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
}