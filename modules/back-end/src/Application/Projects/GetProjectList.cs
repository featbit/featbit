using Domain.Projects;

namespace Application.Projects;

public class GetProjectList : IRequest<IEnumerable<ProjectWithEnvs>>
{
    public Guid OrganizationId { get; set; }
}

public class GetProjectListHandler : IRequestHandler<GetProjectList, IEnumerable<ProjectWithEnvs>>
{
    private readonly IProjectService _service;

    public GetProjectListHandler(IProjectService service)
    {
        _service = service;
    }
    
    public async Task<IEnumerable<ProjectWithEnvs>> Handle(GetProjectList request, CancellationToken cancellationToken)
    {
        return await _service.GetListAsync(request.OrganizationId);
    }
}