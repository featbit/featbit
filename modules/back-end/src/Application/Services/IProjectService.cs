using Domain.Projects;

namespace Application.Services;

public interface IProjectService
{
    Task<ProjectWithEnvs> GetAsync(string id);

    Task<IEnumerable<ProjectWithEnvs>> GetListAsync(string organizationId);
}