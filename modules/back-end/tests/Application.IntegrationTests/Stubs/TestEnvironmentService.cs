using Application.Services;
using Domain.Environments;
using Environment = Domain.Environments.Environment;

namespace Application.IntegrationTests.Stubs;

public class TestEnvironmentService : NullServiceBase<Environment>, IEnvironmentService
{
    public Task<string[]> GetServesAsync(string[] scopes)
    {
        return Task.FromResult(Array.Empty<string>());
    }

    public Task<RpSecret[]> GetRpSecretsAsync(Guid[] envIds)
    {
        return Task.FromResult(Array.Empty<RpSecret>());
    }

    public Task<ResourceDescriptor> GetResourceDescriptorAsync(Guid envId)
    {
        return Task.FromResult(new ResourceDescriptor
        {
            Organization = new IdNameKeyProps
            {
                Id = TestWorkspace.OrganizationId,
                Name = "Test organization",
                Key = "test-org"
            },
            Project = new IdNameKeyProps
            {
                Id = Guid.NewGuid(),
                Name = "Test project",
                Key = "test-project"
            },
            Environment = new IdNameKeyProps
            {
                Id = envId,
                Name = "Test environment",
                Key = "test-env"
            }
        });
    }

    public Task<ICollection<SecretCache>> GetSecretCachesAsync()
    {
        return Task.FromResult<ICollection<SecretCache>>([]);
    }

    public Task AddWithBuiltInPropsAsync(Environment env)
    {
        return Task.CompletedTask;
    }

    public Task AddManyWithBuiltInPropsAsync(ICollection<Environment> envs)
    {
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Guid id)
    {
        return Task.CompletedTask;
    }

    public Task DeleteManyAsync(ICollection<Guid> ids)
    {
        return Task.CompletedTask;
    }

    public Task<bool> HasKeyBeenUsedAsync(Guid projectId, string key)
    {
        return Task.FromResult(false);
    }

    public Task<string> GetProjectEnvAsync(Guid envId)
    {
        return Task.FromResult("test-project/test-env");
    }
}
