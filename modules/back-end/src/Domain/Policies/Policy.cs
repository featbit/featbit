namespace Domain.Policies;

public class Policy
{
    public string Id { get; set; }

    public string OrganizationId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public string Type { get; set; }

    public ICollection<PolicyStatement> Statements { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}