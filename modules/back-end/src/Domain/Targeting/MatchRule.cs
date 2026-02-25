namespace Domain.Targeting;

public class MatchRule
{
    /// <summary>
    /// The unique identifier for the match rule. Usually a GUID.
    /// </summary>
    public string Id { get; set; }

    /// <summary>
    /// The name of the match rule.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The collection of conditions that make up the match rule.
    /// </summary>
    public ICollection<Condition> Conditions { get; set; } = Array.Empty<Condition>();
}