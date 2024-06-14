using Application.Projects;

namespace Application.Organizations;

public class DeleteOrganization : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteOrganizationHandler : IRequestHandler<DeleteOrganization, bool>
{
    private readonly IOrganizationService _organizationService;
    private readonly IProjectService _projectService;
    private readonly IPublisher _publisher;

    public DeleteOrganizationHandler(
        IOrganizationService organizationService,
        IProjectService projectService,
        IPublisher publisher)
    {
        _organizationService = organizationService;
        _projectService = projectService;
        _publisher = publisher;
    }

    public async Task<bool> Handle(DeleteOrganization request, CancellationToken cancellationToken)
    {
        // get organization projects
        var projects = await _projectService.GetListAsync(request.Id);

        // delete organization
        await _organizationService.DeleteAsync(request.Id);

        // publish on project deleted notification
        foreach (var project in projects)
        {
            await _publisher.Publish(new OnProjectDeleted(project), cancellationToken);
        }

        return true;
    }
}