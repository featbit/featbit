namespace Application.AccessTokens;

public class DeleteAccessToken : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteAccessTokenHandler : IRequestHandler<DeleteAccessToken, bool>
{
    private readonly IAccessTokenService _service;

    public DeleteAccessTokenHandler(IAccessTokenService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(DeleteAccessToken request, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(request.Id);

        return true;
    }
}