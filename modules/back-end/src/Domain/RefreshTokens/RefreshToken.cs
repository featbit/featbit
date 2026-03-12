#nullable enable

using System.Security.Cryptography;
using System.Text;

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

    // for ef core
    protected RefreshToken()
    {
        Token = string.Empty;
        UserId = Guid.Empty;
        IsRevoked = true;
    }

    public static RefreshToken NewRecord(string rawToken, Guid userId, int expiryDays, string? createdByIp = null)
    {
        return new RefreshToken
        {
            Token = HashToken(rawToken),
            UserId = userId,
            ExpiresAt = DateTime.UtcNow.AddDays(expiryDays),
            CreatedByIp = createdByIp,
            IsRevoked = false
        };
    }

    public void Revoke(string revokedByIp, string? replacedByRawToken)
    {
        if (IsRevoked)
        {
            return;
        }

        IsRevoked = true;
        RevokedAt = DateTime.UtcNow;
        LastUsedAt = DateTime.UtcNow;
        RevokedByIp = revokedByIp;
        ReplacedByToken = replacedByRawToken is not null
            ? HashToken(replacedByRawToken)
            : null;
        UpdatedAt = DateTime.UtcNow;
    }

    public static string HashToken(string token)
    {
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return ToHexString(hashBytes);

        string ToHexString(byte[] bytes)
        {
            var builder = new StringBuilder(bytes.Length * 2);
            foreach (var b in bytes)
            {
                builder.Append($"{b:x2}");
            }

            return builder.ToString();
        }
    }
}