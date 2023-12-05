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

    public async Task<PagedResult<Webhook>> GetListAsync(Guid orgId, WebhookFilter filter)
    {
        var query = Queryable.Where(x => x.OrgId == orgId);

        // name filter
        if (!string.IsNullOrWhiteSpace(filter.Name))
        {
            query = query.Where(x => x.Name.Contains(filter.Name, StringComparison.CurrentCultureIgnoreCase));
        }

        // projectId filter
        if (!string.IsNullOrWhiteSpace(filter.ProjectId))
        {
            query = query.Where(x => x.Scopes.Any(y => y.StartsWith(filter.ProjectId)));
        }

        var totalCount = await query.CountAsync();
        var webhooks = await query
            .Skip(filter.PageIndex * filter.PageSize)
            .OrderByDescending(x => x.CreatedAt)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<Webhook>(totalCount, webhooks);
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
}