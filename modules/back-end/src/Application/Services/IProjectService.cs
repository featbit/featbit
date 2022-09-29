using Domain.Projects;

namespace Application.Services;

public interface IProjectService
{
    Task<Project> GetAsync(Guid id);

    Task<ProjectWithEnvs> GetWithEnvsAsync(Guid id);

    Task<IEnumerable<ProjectWithEnvs>> GetListAsync(Guid organizationId);

    Task<ProjectWithEnvs> AddWithEnvsAsync(Project project, IEnumerable<string> envNames);

    Task UpdateAsync(Project project);

    Task<bool> DeleteAsync(Guid id);
}