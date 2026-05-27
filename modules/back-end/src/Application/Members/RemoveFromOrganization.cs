namespace Application.Members;

public class RemoveFromOrganization : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }
    
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }
}

public class RemoveFromOrganizationHandler(
    IOrganizationService organizationService, 
    IMemberService service, 
    ISender mediator) : IRequestHandler<RemoveFromOrganization, bool>
{
    public async Task<bool> Handle(RemoveFromOrganization request, CancellationToken cancellationToken)
    {
        await service.DeleteAsync(request.OrganizationId, request.MemberId);

        var orgs = await organizationService.GetUserOrganizationsAsync(request.WorkspaceId, request.MemberId);
        if (orgs.Count == 0)
        {
            await mediator.Send(new RemoveFromWorkspace
            {
                WorkspaceId = request.WorkspaceId,
                MemberId = request.MemberId
            }, cancellationToken);
        }

        return true;
    }
}