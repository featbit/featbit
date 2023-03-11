using Domain.Policies;

namespace Domain.AccessTokens;

public class AccessToken : AuditedEntity
{
    public Guid? OrganizationId { get; set; }

    public string Name { get; set; }

    public string Type { get; set; }

    public ICollection<Policy> Policies { get; set; }

    public AccessToken(Guid organizationId, string name, string type)
    {
        OrganizationId = organizationId;
        Name = name;

        Type = AccessTokenTypes.Personal;
        Policies = Array.Empty<Policy>();
    }
}