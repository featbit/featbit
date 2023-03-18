namespace Application.AccessTokens;

public class IsAccessTokenNameUsed : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }
}

public class IsAccessTokenNameUsedHandler : IRequestHandler<IsAccessTokenNameUsed, bool>
{
    private readonly IAccessTokenService _service;

    public IsAccessTokenNameUsedHandler(IAccessTokenService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(IsAccessTokenNameUsed request, CancellationToken cancellationToken)
    {
        var isNameUsed = await _service.AnyAsync(x =>
            x.OrganizationId == request.OrganizationId &&
            string.Equals(x.Name, request.Name, StringComparison.OrdinalIgnoreCase)
        );

        return isNameUsed;
    }
}