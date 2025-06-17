namespace Domain.RelayProxies;

// we will need to migrate this to ScopeString.cs in the future
public record Scope
{
    public string Id { get; set; }

    public string ProjectId { get; set; }

    public IEnumerable<Guid> EnvIds { get; set; }

    public bool IsValid()
    {
        return !string.IsNullOrWhiteSpace(Id) &&
               !string.IsNullOrWhiteSpace(ProjectId) &&
               (EnvIds?.Any() ?? false);
    }
}