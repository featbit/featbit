namespace Domain.Policies;

public class PolicyStatement
{
    /// <summary>
    /// The ID of the statement. Usually a UUID.
    /// </summary>
    public string Id { get; set; }

    /// <summary>
    /// The resource type of the statement.
    /// </summary>
    public string ResourceType { get; set; }

    /// <summary>
    /// The effect of the statement, e.g., "allow" or "deny".
    /// </summary>
    public string Effect { get; set; }

    /// <summary>
    /// The List of the actions.
    /// </summary>
    public ICollection<string> Actions { get; set; }

    /// <summary>
    /// The List of the resources.
    /// </summary>
    public ICollection<string> Resources { get; set; }
}