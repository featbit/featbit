﻿namespace Domain.RelayProxies;

public class RelayProxy : AuditedEntity
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public bool IsAllEnvs { get; set; }

    public IEnumerable<Scope> Scopes { get; set; }

    public IEnumerable<Agent> Agents { get; set; }

    public RelayProxy(
        Guid organizationId,
        string name,
        string description,
        bool isAllEnvs,
        IEnumerable<Scope> scopes,
        IEnumerable<Agent> agents)
    {
        OrganizationId = organizationId;
        Name = name;
        Description = description;

        IsAllEnvs = isAllEnvs;
        Scopes = scopes;
        Agents = agents;

        Key = $"rp-{TokenHelper.New(Guid.NewGuid())}";
    }

    public void Update(
        string name,
        string description,
        bool isAllEnvs,
        IEnumerable<Scope> scopes,
        IEnumerable<Agent> agents)
    {
        Name = name;
        Description = description;
        IsAllEnvs = isAllEnvs;
        Scopes = scopes;
        Agents = agents;
    }

    public void AgentSynced(Agent agent) => agent.SyncAt = DateTime.UtcNow;
}