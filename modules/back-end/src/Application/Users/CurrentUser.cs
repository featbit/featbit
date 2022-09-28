using Domain.Users;
using Microsoft.AspNetCore.Http;

namespace Application.Users;

public class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUser(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid Id
    {
        get
        {
            var claim = _httpContextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == UserClaims.Id);
            return claim == null ? Guid.Empty : Guid.Parse(claim.Value);
        }
    }
}