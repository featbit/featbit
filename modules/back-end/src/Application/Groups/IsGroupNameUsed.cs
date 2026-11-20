namespace Application.Groups;

public class IsGroupNameUsed : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }
}

public class IsGroupNameUsedHandler(IGroupService service) : IRequestHandler<IsGroupNameUsed, bool>
{
    public async ValueTask<bool> Handle(IsGroupNameUsed request, CancellationToken cancellationToken)
        => await service.IsNameUsedAsync(request.OrganizationId, request.Name);
}