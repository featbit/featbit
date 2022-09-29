using Application.Users;

namespace Application.IntegrationTests.Stubs;

public class TestCurrentUser : ICurrentUser
{
    public Guid Id { get; }

    public TestCurrentUser(Guid id)
    {
        Id = id;
    }
}