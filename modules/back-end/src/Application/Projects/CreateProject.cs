using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Projects;

namespace Application.Projects;

public class CreateProject : IRequest<ProjectWithEnvs>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }

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

    public CreateProjectHandler(IProjectService service)
    {
        _service = service;
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
        return projectWithEnvs;
    }
}