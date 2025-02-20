namespace Application.Policies;

public class IsPolicyNameUsed : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }
}

public class IsPolicyNameUsedHandler(IPolicyService service) : IRequestHandler<IsPolicyNameUsed, bool>
{
    public async Task<bool> Handle(IsPolicyNameUsed request, CancellationToken cancellationToken) =>
        await service.IsNameUsedAsync(request.OrganizationId, request.Name);
}