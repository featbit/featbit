namespace Application.Policies;

public class IsPolicyKeyUsed : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string Key { get; set; }
}

public class IsPolicyKeyUsedHandler(IPolicyService service) : IRequestHandler<IsPolicyKeyUsed, bool>
{
    public async Task<bool> Handle(IsPolicyKeyUsed request, CancellationToken cancellationToken) =>
        await service.IsKeyUsedAsync(request.OrganizationId, request.Key);
}