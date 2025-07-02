using Domain.Environments;
using Environment = Domain.Environments.Environment;

namespace Application.Services;

public interface IEnvironmentService : IService<Environment>
{
    Task<string[]> GetServesAsync(string[] scopes);

    Task<RpSecret[]> GetRpSecretsAsync(Guid[] envIds);

    Task<ResourceDescriptor> GetResourceDescriptorAsync(Guid envId);

    Task AddWithBuiltInPropsAsync(Environment env);

    Task AddManyWithBuiltInPropsAsync(ICollection<Environment> envs);

    Task DeleteAsync(Guid id);

    Task DeleteManyAsync(ICollection<Guid> ids);

    Task<IEnumerable<Setting>> GetSettingsAsync(Guid envId, string type);

    Task<bool> HasKeyBeenUsedAsync(Guid projectId, string key);
}