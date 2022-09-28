namespace Application.Policies;

public class PolicyGroup
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public bool IsPolicyGroup { get; set; }
}