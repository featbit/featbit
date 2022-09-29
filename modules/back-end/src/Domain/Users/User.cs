using System.Security.Claims;

namespace Domain.Users;

public class User : AuditedEntity
{
    public string Email { get; set; }

    public string Password { get; set; }

    /// <summary>
    /// for test project use only
    /// </summary>
    public User(Guid id, string email, string password)
    {
        Id = id;
        
        Email = email;
        Password = password;

        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public User(string email, string password)
    {
        Email = email;
        Password = password;

        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public IEnumerable<Claim> Claims()
    {
        var claims = new List<Claim>
        {
            new(UserClaims.Id, Id.ToString()),
            new(UserClaims.Email, Email)
        };

        return claims;
    }
}