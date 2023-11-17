using Domain.Users;

namespace Application.Users;

public class Profile
{
    public Guid Id { get; set; }

    public string Email { get; set; }

    public string Name { get; set; }

    public Guid WorkspaceId { get; set; }

    public string Origin { get; set; }

    public Profile(User user)
    {
        Id = user.Id;
        Email = user.Email;
        Name = user.Name;
        Origin = user.Origin ?? UserOrigin.Local;
        WorkspaceId = user.WorkspaceId;
    }
}