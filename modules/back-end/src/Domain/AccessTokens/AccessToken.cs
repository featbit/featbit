using Domain.Policies;

namespace Domain.AccessTokens;

public class AccessToken : AuditedEntity
{
    public Guid? OrganizationId { get; set; }

    public string Name { get; set; }

    public string Type { get; set; }
    public string Status { get; set; }

    public Guid CreatorId { get; set; }

    public ICollection<Policy> Policies { get; set; }
    
    public DateTime? LastUsedAt { get; set; }

    public AccessToken(Guid organizationId, Guid creatorId, string name, string type, IEnumerable<Policy> policies)
    {
        OrganizationId = organizationId;
        CreatorId = creatorId;
        Name = name;
        
        Status = AccessTokenStatus.Active;
        Type = AccessTokenTypes.Personal;
        Policies = policies.ToArray();
    }
    
    public void RefreshLastUsedAt()
    {
        LastUsedAt = DateTime.UtcNow;
    }
}