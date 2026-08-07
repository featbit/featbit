using Domain.Policies;

namespace Application.AccessTokens;

public class ToggleAccessTokenStatus : IRequest<bool>
{
    public Guid Id { get; set; }

    public Guid OrganizationId { get; set; }

    public PolicyStatement[] CurrentUserPermissions { get; set; } = [];
}

public class ToggleAccessTokenStatusHandler(IAccessTokenService service)
    : IRequestHandler<ToggleAccessTokenStatus, bool>
{
    public async Task<bool> Handle(ToggleAccessTokenStatus request, CancellationToken cancellationToken)
    {
        var accessToken = await service.GetAsync(request.Id);

        AccessTokenAuthorization.EnsureOrganization(accessToken, request.OrganizationId);
        AccessTokenAuthorization.EnsureCanManage(request.CurrentUserPermissions, accessToken.Type);

        accessToken.ToggleStatus();
        await service.UpdateAsync(accessToken);

        return true;
    }
}
