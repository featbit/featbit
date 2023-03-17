using Domain.Policies;

namespace Domain.AccessTokens;

public class AccessToken : AuditedEntity
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }

    public string Type { get; set; }

    public string Status { get; set; }

    public string Token { get; set; }

    public Guid CreatorId { get; set; }

    public IEnumerable<PolicyStatement> Permissions { get; set; }

    public DateTime? LastUsedAt { get; set; }

    public AccessToken(
        Guid organizationId,
        Guid creatorId,
        string name,
        string type,
        IEnumerable<PolicyStatement> permissions)
    {
        OrganizationId = organizationId;
        CreatorId = creatorId;
        Name = name;

        Status = AccessTokenStatus.Active;
        Type = type;
        Permissions = permissions;

        Token = $"api-{TokenHelper.New(Guid.NewGuid())}";
    }

    public void RefreshLastUsedAt()
    {
        LastUsedAt = DateTime.UtcNow;
    }

    public void ToggleStatus()
    {
        Status = Status == AccessTokenStatus.Active ? AccessTokenStatus.Inactive : AccessTokenStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateName(string name)
    {
        Name = name;
        UpdatedAt = DateTime.UtcNow;
    }
}