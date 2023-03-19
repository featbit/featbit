namespace Application.Policies;

public class IsPolicyNameUsed : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }
}

public class IsPolicyNameUsedHandler : IRequestHandler<IsPolicyNameUsed, bool>
{
    private readonly IPolicyService _service;

    public IsPolicyNameUsedHandler(IPolicyService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(IsPolicyNameUsed request, CancellationToken cancellationToken)
    {
        var isNameUsed =
            await _service.AnyAsync(x => x.OrganizationId == request.OrganizationId && string.Equals(x.Name, request.Name, StringComparison.OrdinalIgnoreCase));

        return isNameUsed;
    }
}