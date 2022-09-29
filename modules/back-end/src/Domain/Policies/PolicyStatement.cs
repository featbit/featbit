namespace Domain.Policies;

public class PolicyStatement
{
    public string Id { get; set; }

    public string ResourceType { get; set; }

    public string Effect { get; set; }

    public ICollection<string> Actions { get; set; }

    public ICollection<string> Resources { get; set; }
}