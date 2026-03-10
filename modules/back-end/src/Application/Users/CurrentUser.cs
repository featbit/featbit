using Domain.Policies;
using Domain.Users;
using Microsoft.AspNetCore.Http;

namespace Application.Users;

public class CurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    public Guid Id
    {
        get
        {
            var httpContext = httpContextAccessor.HttpContext;
            if (httpContext == null)
            {
                return Guid.Empty;
            }

            var claim = httpContext.User.Claims.FirstOrDefault(x => x.Type == UserClaims.Id);
            return claim == null ? Guid.Empty : Guid.Parse(claim.Value);
        }
    }

    public IEnumerable<PolicyStatement> Permissions
    {
        get
        {
            var httpContext = httpContextAccessor.HttpContext;
            if (httpContext == null)
            {
                return [];
            }

            return httpContext.Items[ApplicationConsts.UserPermissionsItem] as IEnumerable<PolicyStatement> ?? [];
        }
    }
}