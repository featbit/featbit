using Domain.RelayProxies;

namespace Application.RelayProxies;

public class RelayProxyVm
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public bool IsAllEnvs { get; set; }

    public IEnumerable<Scope> Scopes { get; set; }
    
    public IEnumerable<Agent> Agents { get; set; }
}