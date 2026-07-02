using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Projects;

namespace Application.Projects;

public class CreateProject : IRequest<ProjectWithEnvs>
{
    /// <summary>
    /// The ID of the organization the project belongs to. Retrieved from the request header.
    /// </summary>
    public Guid OrganizationId { get; set; }

    /// <summary>
    /// The name of the project
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The unique key of the project
    /// </summary>
    public string Key { get; set; }
}

public class CreateProjectValidator : AbstractValidator<CreateProject>
{
    public CreateProjectValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"));
    }
}

public class CreateProjectHandler : IRequestHandler<CreateProject, ProjectWithEnvs>
{
    private readonly IProjectService _service;
    private readonly IPublisher _publisher;

    public CreateProjectHandler(IProjectService service, IPublisher publisher)
    {
        _service = service;
        _publisher = publisher;
    }

    public async Task<ProjectWithEnvs> Handle(CreateProject request, CancellationToken cancellationToken)
    {
        var keyHasBeenUsed = await _service.HasKeyBeenUsedAsync(request.OrganizationId, request.Key);
        if (keyHasBeenUsed)
        {
            throw new BusinessException(ErrorCodes.KeyHasBeenUsed);
        }

        var project = new Project(request.OrganizationId, request.Name, request.Key);
        var projectWithEnvs = await _service.AddWithEnvsAsync(project, new[] { "Prod", "Dev" });

        // publish on project added notification
        await _publisher.Publish(new OnProjectAdded(projectWithEnvs), cancellationToken);

        return projectWithEnvs;
    }
}