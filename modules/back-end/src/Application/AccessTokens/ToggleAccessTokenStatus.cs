namespace Application.AccessTokens;

public class ToggleAccessTokenStatus : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class ToggleAccessTokenStatusHandler : IRequestHandler<ToggleAccessTokenStatus, bool>
{
    private readonly IAccessTokenService _service;

    public ToggleAccessTokenStatusHandler(IAccessTokenService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(ToggleAccessTokenStatus request, CancellationToken cancellationToken)
    {
        var accessToken = await _service.GetAsync(request.Id);
        accessToken.ToggleStatus();

        await _service.UpdateAsync(accessToken);

        return true;
    }
}