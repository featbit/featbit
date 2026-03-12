using System.Security.Cryptography;
using System.Text;
using Domain.RefreshTokens;

namespace Infrastructure.Services;

public class TokenHashService : ITokenHashService
{
    public string GenerateToken()
    {
        return Guid.NewGuid().ToString("N");
    }

    public string HashToken(string token)
    {
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(token));
        return ToHexString(hashBytes);
    }

    private static string ToHexString(byte[] bytes)
    {
        var builder = new StringBuilder(bytes.Length * 2);
        foreach (var b in bytes)
        {
            builder.Append($"{b:x2}");
        }
        return builder.ToString();
    }
}