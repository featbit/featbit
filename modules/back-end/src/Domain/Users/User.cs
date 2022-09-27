using System.Security.Claims;

namespace Domain.Users;

public class User : AuditedEntity
{
    public string Email { get; set; }

    public string Password { get; set; }

    public User(string id, string email, string password)
    {
        Id = id;
        Email = email;
        Password = password;

        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public IEnumerable<Claim> Claims()
    {
        var claims = new List<Claim>
        {
            new(UserClaims.Id, Id),
            new(UserClaims.Email, Email)
        };

        return claims;
    }
}