namespace Application.AccessTokens;

public class IsNameUsed : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }
}

public class IsNameUsedHandler : IRequestHandler<IsNameUsed, bool>
{
    private readonly IAccessTokenService _service;

    public IsNameUsedHandler(IAccessTokenService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(IsNameUsed request, CancellationToken cancellationToken)
    {
        var isNameUsed = await _service.AnyAsync(x =>
            x.OrganizationId == request.OrganizationId &&
            string.Equals(x.Name, request.Name, StringComparison.OrdinalIgnoreCase)
        );

        return isNameUsed;
    }
}