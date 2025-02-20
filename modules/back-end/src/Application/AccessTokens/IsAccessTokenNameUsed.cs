namespace Application.AccessTokens;

public class IsAccessTokenNameUsed : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }
}

public class IsAccessTokenNameUsedHandler(IAccessTokenService service) : IRequestHandler<IsAccessTokenNameUsed, bool>
{
    public async Task<bool> Handle(IsAccessTokenNameUsed request, CancellationToken cancellationToken) =>
        await service.IsNameUsedAsync(request.OrganizationId, request.Name);
}