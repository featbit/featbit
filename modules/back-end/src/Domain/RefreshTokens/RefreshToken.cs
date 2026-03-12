#nullable enable

namespace Domain.RefreshTokens;

public class RefreshToken : AuditedEntity
{
    public string Token { get; set; }

    public Guid UserId { get; set; }

    public bool IsRevoked { get; set; }

    public string? ReplacedByToken { get; set; }

    public string? CreatedByIp { get; set; }

    public string? RevokedByIp { get; set; }
    
    public DateTime ExpiresAt { get; set; }
    
    public DateTime? RevokedAt { get; set; }
    
    public DateTime? LastUsedAt { get; set; }
    
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    
    public bool IsActive => !IsRevoked && !IsExpired;
    
    public RefreshToken(
        string token,
        Guid userId,
        DateTime expiresAt,
        string? createdByIp = null)
    {
        Token = token;
        UserId = userId;
        ExpiresAt = expiresAt;
        CreatedByIp = createdByIp;
        IsRevoked = false;
    }

    public void Revoke(string? revokedByIp = null, string? replacedByToken = null)
    {
        if (IsRevoked)
        {
            throw new InvalidOperationException("Token is already revoked");
        }

        IsRevoked = true;
        RevokedAt = DateTime.UtcNow;
        LastUsedAt  = DateTime.UtcNow;
        RevokedByIp = revokedByIp;
        ReplacedByToken = replacedByToken;
        UpdatedAt = DateTime.UtcNow;
    }
}