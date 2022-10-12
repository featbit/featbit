using Environment = Domain.Environments.Environment;

namespace Application.Services;

public interface IEnvironmentService : IService<Environment>
{
    Task DeleteAsync(Guid id);
}