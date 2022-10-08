namespace Domain.Targeting;

public class MatchRule
{
    public string Id { get; set; }

    public string Name { get; set; }

    public ICollection<Condition> Conditions { get; set; } = Array.Empty<Condition>();
}