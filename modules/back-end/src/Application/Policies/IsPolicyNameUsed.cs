namespace Application.Policies;

public class IsPolicyNameUsed : IRequest<bool>
{
    public string OrganizationId { get; set; }

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
        var isNameUsed = await _service.IsNameUsedAsync(request.OrganizationId, request.Name);
        
        return isNameUsed;
    }
}