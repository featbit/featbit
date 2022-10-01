using Environment = Domain.Environments.Environment;

namespace Application.Services;

public interface IEnvironmentService
{
    Task<Environment> GetAsync(Guid id);

    Task AddAsync(Environment env);

    Task UpdateAsync(Environment env);
    
    Task DeleteAsync(Guid id);
}