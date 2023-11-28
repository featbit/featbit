using Domain.Webhooks;

namespace Application.Services;

public interface IWebhookService : IService<Webhook>
{
    Task<bool> IsNameUsedAsync(Guid orgId, string name);
}