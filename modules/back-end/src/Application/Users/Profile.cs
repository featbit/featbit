using Domain.Users;

namespace Application.Users;

public class Profile
{
    public string Id { get; set; }

    public string Email { get; set; }

    public Profile(User user)
    {
        Id = user.Id;
        Email = user.Email;
    }
}