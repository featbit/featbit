using Application.Users;
using Domain.Policies;

namespace Application.IntegrationTests.Stubs;

public class TestCurrentUser : ICurrentUser
{
    public Guid Id { get; }
    public IEnumerable<PolicyStatement> Permissions { get; }

    public TestCurrentUser(Guid id)
    {
        Id = id;
        Permissions = [];
    }
}