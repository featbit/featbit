using Domain.Users;

namespace Application.Users;

public class Profile
{
    public Guid Id { get; set; }

    public string Email { get; set; }

    public string Name { get; set; }

    public Profile(User user)
    {
        Id = user.Id;
        Email = user.Email;
        Name = user.Name;
    }
}