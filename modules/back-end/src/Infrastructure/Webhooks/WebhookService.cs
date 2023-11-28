using Domain.Webhooks;

namespace Infrastructure.Webhooks;

public class WebhookService : MongoDbService<Webhook>, IWebhookService
{
    public WebhookService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<bool> IsNameUsedAsync(Guid orgId, string name)
    {
        return await AnyAsync(x =>
            x.OrgId == orgId &&
            string.Equals(x.Name, name, StringComparison.OrdinalIgnoreCase)
        );
    }
}