using System.Security.Claims;

namespace Domain.Users;

public class User
{
    public string Id { get; set; }

    public string Email { get; set; }

    public string Password { get; set; }
    
    public DateTime CreatedAt { get; set; }

    public User(string id, string email, string password)
    {
        Id = id;
        Email = email;
        Password = password;
        
        CreatedAt = DateTime.UtcNow;
    }

    public IEnumerable<Claim> Claims()
    {
        var claims = new List<Claim>
        {
            new("id", Id),
            new("email", Email)
        };

        return claims;
    }
}