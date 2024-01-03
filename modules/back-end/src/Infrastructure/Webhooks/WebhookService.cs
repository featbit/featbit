using Application.Bases.Models;
using Application.Webhooks;
using Domain.Webhooks;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Webhooks;

public class WebhookService : MongoDbService<Webhook>, IWebhookService
{
    public WebhookService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task AddDeliveryAsync(WebhookDelivery delivery)
    {
        await MongoDb.CollectionOf<WebhookDelivery>().InsertOneAsync(delivery);
    }

    public async Task<PagedResult<Webhook>> GetListAsync(Guid orgId, WebhookFilter filter)
    {
        var query = Queryable.Where(x => x.OrgId == orgId);

        // name filter
        if (!string.IsNullOrWhiteSpace(filter.Name))
        {
            query = query.Where(x => x.Name.Contains(filter.Name, StringComparison.CurrentCultureIgnoreCase));
        }

        // envId filter
        if (!string.IsNullOrWhiteSpace(filter.EnvId))
        {
            query = query.Where(x => x.Scopes.Any(y => y.Contains(filter.EnvId)));
        }

        // projectId filter
        if (!string.IsNullOrWhiteSpace(filter.ProjectId) && string.IsNullOrWhiteSpace(filter.EnvId))
        {
            query = query.Where(x => x.Scopes.Any(y => y.StartsWith(filter.ProjectId)));
        }

        var totalCount = await query.CountAsync();
        var webhooks = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip(filter.PageIndex * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<Webhook>(totalCount, webhooks);
    }

    public async Task<List<Webhook>> GetByEventsAsync(Guid orgId, string[] events)
    {
        IMongoQueryable<Webhook> query;

        if (events.Length == 1)
        {
            query = Queryable.Where(x => x.OrgId == orgId && x.Events.Contains(events[0]));
        }
        else
        {
            var values = events.Select(y => new StringOrRegularExpression(y));
            query = Queryable.Where(x => x.OrgId == orgId && x.Events.AnyStringIn(values));
        }

        return await query.ToListAsync();
    }

    public async Task<bool> IsNameUsedAsync(Guid orgId, string name)
    {
        return await AnyAsync(x =>
            x.OrgId == orgId &&
            string.Equals(x.Name, name, StringComparison.OrdinalIgnoreCase)
        );
    }

    public async Task DeleteAsync(Guid id)
    {
        await Collection.DeleteOneAsync(x => x.Id == id);
    }

    public async Task<PagedResult<WebhookDelivery>> GetDeliveriesAsync(Guid webhookId, WebhookDeliveryFilter filter)
    {
        var query = MongoDb.QueryableOf<WebhookDelivery>().Where(x => x.WebhookId == webhookId);

        // not before filter, default to 15 days ago
        var notBefore = filter.NotBefore ?? DateTime.UtcNow.AddDays(-15);
        query = query.Where(x => x.StartedAt >= notBefore);

        // event filter
        if (!string.IsNullOrWhiteSpace(filter.Event))
        {
            query = query.Where(x => x.Events.Contains(filter.Event));
        }

        // success filter
        var success = filter.Success;
        if (success.HasValue)
        {
            query = query.Where(x => x.Success == success.Value);
        }

        var totalCount = await query.CountAsync();
        var deliveries = await query
            .OrderByDescending(x => x.StartedAt)
            .Skip(filter.PageIndex * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<WebhookDelivery>(totalCount, deliveries);
    }
}