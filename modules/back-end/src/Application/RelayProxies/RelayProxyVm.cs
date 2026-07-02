using Domain.RelayProxies;

namespace Application.RelayProxies;

public class RelayProxyVm
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public bool IsAllEnvs { get; set; }

    public string[] Scopes { get; set; }

    public string[] Serves { get; set; }

    public Agent[] Agents { get; set; }

    public AutoAgent[] AutoAgents { get; set; }

    public DateTime UpdatedAt { get; set; }
}