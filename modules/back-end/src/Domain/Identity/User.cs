using System.Security.Claims;

namespace Domain.Identity;

public class User
{
    public string Id { get; set; }

    public string Identity { get; set; }

    public string Password { get; set; }
    
    public DateTime CreatedAt { get; set; }

    public User(string id, string identity, string password)
    {
        Id = id;
        Identity = identity;
        Password = password;
        
        CreatedAt = DateTime.UtcNow;
    }

    public IEnumerable<Claim> Claims()
    {
        var claims = new List<Claim>
        {
            new("id", Id),
            new("identity", Identity)
        };

        return claims;
    }
}