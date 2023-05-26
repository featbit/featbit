namespace Domain.RelayProxies;

public class RelayProxyScope
{
    public string Id { get; set; }

    public string ProjectId { get; set; }

    public IEnumerable<string> EnvIds { get; set; }
}