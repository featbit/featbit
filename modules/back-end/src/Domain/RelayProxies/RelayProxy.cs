namespace Domain.RelayProxies;

public class RelayProxy : AuditedEntity
{
    public Guid OrganizationId { get; set; }
    
    public string Name { get; set; }
    
    public string Key { get; set; }
    
    public string Description { get; set; }

    public bool IsAllEnvs { get; set; }

    public IEnumerable<RelayProxyScope> Scopes { get; set; }
    
    public IEnumerable<RelayProxyAgent> Agents { get; set; }
    
    public RelayProxy(
        Guid organizationId,
        string name,
        string description,
        bool isAllEnvs,
        IEnumerable<RelayProxyScope> scopes,
        IEnumerable<RelayProxyAgent> agents)
    {
        OrganizationId = organizationId;
        Name = name;
        Description = description;

        IsAllEnvs = isAllEnvs;
        Scopes = scopes;
        Agents = agents;
        
        Key = $"rp-{TokenHelper.New(Guid.NewGuid())}";
    }

    public void Update(string name, string description, bool isAllEnvs, IEnumerable<RelayProxyScope> scopes, IEnumerable<RelayProxyAgent> agents)
    {
        Name = name;
        Description = description;
        IsAllEnvs = isAllEnvs;
        Scopes = scopes;
        Agents = agents;
    }
}