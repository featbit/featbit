using Application.Users;

namespace Application.IntegrationTests.Stubs;

public class TestCurrentUser : ICurrentUser
{
    public string Id { get; }

    public TestCurrentUser(string id)
    {
        Id = id;
    }
}