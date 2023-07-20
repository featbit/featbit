using Domain.Projects;

namespace Application.Services;

public interface IProjectService : IService<Project>
{
    Task<ProjectWithEnvs> GetWithEnvsAsync(Guid id);

    Task<IEnumerable<ProjectWithEnvs>> GetListAsync(Guid organizationId);

    Task<ProjectWithEnvs> AddWithEnvsAsync(Project project, IEnumerable<string> envNames);

    Task<bool> HasKeyBeenUsedAsync(Guid organizationId, string key);

    Task<bool> DeleteAsync(Guid id);
}