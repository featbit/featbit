using Domain.Targeting;

namespace Domain.Segments;

public class Segment : AuditedEntity
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public IEnumerable<string> Included { get; set; }

    public IEnumerable<string> Excluded { get; set; }

    public ICollection<MatchRule> Rules { get; set; }

    public bool IsArchived { get; set; }

    public Segment(
        Guid envId,
        string name,
        IEnumerable<string> included,
        IEnumerable<string> excluded,
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

    public void Update(
        string name,
        IEnumerable<string> included,
        IEnumerable<string> excluded,
        ICollection<MatchRule> rules,
        string description)
    {
        Name = name;
        Included = included ?? Array.Empty<string>();
        Excluded = excluded ?? Array.Empty<string>();
        Rules = rules;
        Description = description ?? string.Empty;

        UpdatedAt = DateTime.UtcNow;
    }

    public void Archive()
    {
        IsArchived = true;
        UpdatedAt = DateTime.UtcNow;
    }
}