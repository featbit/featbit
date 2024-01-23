using Domain.Projects;

namespace Application.Projects;

public class GetProject : IRequest<ProjectWithEnvs>
{
    public Guid Id { get; set; }
}

public class GetProjectHandler : IRequestHandler<GetProject, ProjectWithEnvs>
{
    private readonly IProjectService _service;

    public GetProjectHandler(IProjectService service)
    {
        _service = service;
    }

    public async Task<ProjectWithEnvs> Handle(GetProject request, CancellationToken cancellationToken)
    {
        return await _service.GetWithEnvsAsync(request.Id);
    }
}