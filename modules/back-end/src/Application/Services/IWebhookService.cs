using Application.Bases.Models;
using Application.Webhooks;
using Domain.Webhooks;

namespace Application.Services;

public interface IWebhookService : IService<Webhook>
{
    Task<PagedResult<Webhook>> GetListAsync(Guid orgId, WebhookFilter filter);

    Task<bool> IsNameUsedAsync(Guid orgId, string name);

    Task DeleteAsync(Guid id);
}