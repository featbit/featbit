using Domain.Policies;

namespace Api.Authorization;

public interface IRequestPermissions
{
    Task<PolicyStatement[]> GetAsync(HttpContext context);
}