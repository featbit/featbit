namespace Application.Organizations;

public class DeleteOrganization : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteOrganizationHandler : IRequestHandler<DeleteOrganization, bool>
{
    private readonly IOrganizationService _service;

    public DeleteOrganizationHandler(IOrganizationService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(DeleteOrganization request, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(request.Id);

        return true;
    }
}