using Domain.Projects;

namespace Application.Services;

public interface IProjectService
{
    Task<ProjectWithEnvs> GetAsync(Guid id);

    Task<IEnumerable<ProjectWithEnvs>> GetListAsync(Guid organizationId);
}