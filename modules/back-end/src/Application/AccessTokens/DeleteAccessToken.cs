using Domain.Policies;

namespace Application.AccessTokens;

public class DeleteAccessToken : IRequest<bool>
{
    public Guid Id { get; set; }

    public Guid OrganizationId { get; set; }

    public PolicyStatement[] CurrentUserPermissions { get; set; } = [];
}

public class DeleteAccessTokenHandler(IAccessTokenService service) : IRequestHandler<DeleteAccessToken, bool>
{
    public async Task<bool> Handle(DeleteAccessToken request, CancellationToken cancellationToken)
    {
        var accessToken = await service.GetAsync(request.Id);

        AccessTokenAuthorization.EnsureOrganization(accessToken, request.OrganizationId);
        AccessTokenAuthorization.EnsureCanManage(request.CurrentUserPermissions, accessToken.Type);

        await service.DeleteOneAsync(request.Id);

        return true;
    }
}
