namespace Application.AccessTokens;

public class DeleteAccessToken : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteAccessTokenHandler(IAccessTokenService service) : IRequestHandler<DeleteAccessToken, bool>
{
    public async Task<bool> Handle(DeleteAccessToken request, CancellationToken cancellationToken)
    {
        await service.DeleteOneAsync(request.Id);

        return true;
    }
}