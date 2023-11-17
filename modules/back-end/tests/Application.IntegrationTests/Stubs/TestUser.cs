using Domain.Users;

namespace Application.IntegrationTests.Stubs;

public static class TestUser
{
    public static readonly Guid Id = new("d082c894-d9b5-4846-99e9-ae27ab7d247d");
    public const string Email = "test@email.com";
    public const string RealPassword = "pwd";
    public const string HashedPassword = "hashed-pwd";

    public static User Instance()
    {
        return new User(Id, TestWorkspace.Id, Email, HashedPassword);
    }
}