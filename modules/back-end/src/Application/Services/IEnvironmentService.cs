using Domain.Environments;
using Environment = Domain.Environments.Environment;

namespace Application.Services;

public interface IEnvironmentService : IService<Environment>
{
    Task DeleteAsync(Guid id);

    Task<IEnumerable<Setting>> GetSettingsAsync(Guid envId, string type);

    Task<bool> HasKeyBeenUsedAsync(Guid projectId, string key);
}