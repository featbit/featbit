using System.Security.Claims;

namespace Domain.Users;

public class User : AuditedEntity
{
    public string Name { get; set; }

    public string Email { get; set; }

    public string Password { get; set; }

    public string Origin { get; set; }

    public Guid AccountId { get; set; }

    /// <summary>
    /// for test project use only
    /// </summary>
    public User(Guid accountId, Guid id, string email, string password, string name = "", string origin = UserOrigin.Local)
    {
        Id = id;

        Email = email;
        Password = password;
        Name = name;
        Origin = origin;

        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public User(Guid accountId, string email, string password, string name = "", string origin = UserOrigin.Local)
    {
        Email = email;
        Password = password;
        Name = name;
        Origin = origin;

        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public IEnumerable<Claim> Claims()
    {
        var claims = new List<Claim>
        {
            new(UserClaims.Id, Id.ToString()),
            new(UserClaims.Email, Email),
            new(UserClaims.AccountId, AccountId.ToString()),
        };

        return claims;
    }

    public void Update(string email, string name)
    {
        Email = email;
        Name = name;

        UpdatedAt = DateTime.UtcNow;
    }
}