using System.Security.Claims;

namespace Domain.Users;

public class User : AuditedEntity
{
    public Guid WorkspaceId { get; set; }

    public string Name { get; set; }

    public string Email { get; set; }

    public string Password { get; set; }

    public string Origin { get; set; }

    /// <summary>
    /// for test project use only
    /// </summary>
    public User(Guid id, Guid workspaceId, string email, string password, string name = "", string origin = UserOrigin.Local)
    {
        Id = id;

        WorkspaceId = workspaceId;
        Email = email;
        Password = password;
        Name = name;
        Origin = origin;

        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public User(Guid workspaceId, string email, string password, string name = "", string origin = UserOrigin.Local)
    {
        WorkspaceId = workspaceId;
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
            new(UserClaims.WorkspaceId, WorkspaceId.ToString()),
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