using System.Text;
using Domain.Policies;

namespace Domain.AccessTokens;

public class AccessToken : AuditedEntity
{
    public Guid? OrganizationId { get; set; }

    public string Name { get; set; }

    public string Type { get; set; }
    public string Status { get; set; }
    public string Token { get; set; }
    public Guid CreatorId { get; set; }

    public IEnumerable<PolicyStatement> Permissions { get; set; }
    
    public DateTime? LastUsedAt { get; set; }

    private string NewToken()
    {
        // timestamp in millis, length is 13
        var reversedTimestamp =
            new string(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString().Reverse().ToArray());

        // header length is (13 + 2) * 4/3 = 20, we trim '=' character, so got 18 chars
        var header = Convert.ToBase64String(Encoding.UTF8.GetBytes(reversedTimestamp)).TrimEnd('=');

        // 22 chars
        var guid = GuidHelper.Encode(Guid.NewGuid());

        // 4 + 18 + 22 = 44 chars
        return $"api-{header}{guid}";
    }
    
    public AccessToken(Guid organizationId, Guid creatorId, string name, string type, IEnumerable<PolicyStatement> permissions)
    {
        OrganizationId = organizationId;
        CreatorId = creatorId;
        Name = name;
        
        Status = AccessTokenStatus.Active;
        Type = type;
        Permissions = permissions;

        Token = NewToken();
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