using Application.Bases;
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
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
        
        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.KeyIsRequired);
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
        var project = new Project(request.OrganizationId, request.Name, request.Key);

        var projectWithEnvs = await _service.AddWithEnvsAsync(project, new[] { "Prod", "Dev" });
        return projectWithEnvs;
    }
}