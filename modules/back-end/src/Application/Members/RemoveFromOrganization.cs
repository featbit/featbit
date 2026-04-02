namespace Application.Members;

public class RemoveFromOrganization : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }
}

public class RemoveFromOrganizationHandler(IMemberService service) : IRequestHandler<RemoveFromOrganization, bool>
{
    public async Task<bool> Handle(RemoveFromOrganization request, CancellationToken cancellationToken)
    {
        await service.DeleteAsync(request.OrganizationId, request.MemberId);

        return true;
    }
}