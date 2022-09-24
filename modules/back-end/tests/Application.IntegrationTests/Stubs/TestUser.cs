using Domain.Users;

namespace Application.IntegrationTests.Stubs;

public class TestUser
{
    public const string Id = "id";
    public const string Email = "test@email.com";
    public const string RealPassword = "pwd";
    public const string HashedPassword = "hashed-pwd";

    public static User Instance()
    {
        return new User(Id, Email, HashedPassword);
    }
}