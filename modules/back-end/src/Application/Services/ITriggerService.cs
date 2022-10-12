using Domain.Triggers;

namespace Application.Services;

public interface ITriggerService : IService<Trigger>
{
    Task<ICollection<Trigger>> GetListAsync(Guid targetId);

    Task DeleteAsync(Guid id);
}