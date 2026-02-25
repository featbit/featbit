using Application.Bases;

namespace Application.Projects;

public class UpdateProject : IRequest<ProjectVm>
{
    /// <summary>
    /// The ID of the project to update. Retrieved from the URL path.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The new name for the project
    /// </summary>
    public string Name { get; set; }
}

public class UpdateProjectValidator : AbstractValidator<UpdateProject>
{
    public UpdateProjectValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class UpdateProjectHandler : IRequestHandler<UpdateProject, ProjectVm>
{
    private readonly IProjectService _service;
    private readonly IMapper _mapper;

    public UpdateProjectHandler(IProjectService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<ProjectVm> Handle(UpdateProject request, CancellationToken cancellationToken)
    {
        var project = await _service.GetAsync(request.Id);

        project.Update(request.Name);

        await _service.UpdateAsync(project);

        return _mapper.Map<ProjectVm>(project);
    }
}