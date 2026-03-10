using Domain.Policies;

namespace Application.Users;

public interface ICurrentUser
{
    Guid Id { get; }

    IEnumerable<PolicyStatement> Permissions { get; }
}