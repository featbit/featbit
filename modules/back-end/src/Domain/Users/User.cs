using System.Security.Claims;

namespace Domain.Users;

public class User : AuditedEntity
{
    public string Name { get; set; }

    public string Email { get; set; }

    public string Password { get; set; }

    public string Origin { get; set; }
    
    public string InitialPassword { get; set; }

    /// <summary>
    /// for test project use only
    /// </summary>
    public User(Guid id, string email, string password, string name = "", string origin = UserOrigin.Local)
    {
        Id = id;
        
        Email = email;
        Password = password;
        Name = name;
        Origin = origin;

        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public User(string email, string password, string name = null, string origin = UserOrigin.Local)
    {
        Email = email;
        Password = password;
        Name = string.IsNullOrWhiteSpace(name) ? email.Split('@')[0] : name;
        Origin = origin;

        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public IEnumerable<Claim> Claims()
    {
        var claims = new List<Claim>
        {
            new(UserClaims.Id, Id.ToString())
        };

        return claims;
    }

    public void Update(string email, string name)
    {
        Email = email;
        Name = name;

        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdatePassword(string password)
    {
        Password = password;
        InitialPassword = string.Empty;
        UpdatedAt = DateTime.UtcNow;
    }
}