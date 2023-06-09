namespace Domain.RelayProxies;

public class Scope
{
    public string Id { get; set; }

    public string ProjectId { get; set; }

    public IEnumerable<Guid> EnvIds { get; set; }
}