using Application.Bases.Models;
using Application.Webhooks;
using Domain.Webhooks;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class WebhookService(AppDbContext dbContext) : EntityFrameworkCoreService<Webhook>(dbContext), IWebhookService
{
    public async Task AddDeliveryAsync(WebhookDelivery delivery)
    {
        SetOf<WebhookDelivery>().Add(delivery);

        await SaveChangesAsync();
    }

    public async Task<PagedResult<Webhook>> GetListAsync(Guid orgId, WebhookFilter filter)
    {
        var query = Queryable.Where(x => x.OrgId == orgId);

        // name filter
        var name = filter.Name?.ToLower();
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.ToLower().Contains(name));
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
        var query = events.Length == 1
            ? Queryable.Where(x => x.OrgId == orgId && x.Events.Contains(events[0]))
            : Queryable.Where(x => x.OrgId == orgId && x.Events.Any(y => events.Contains(y)));

        return await query.ToListAsync();
    }

    public async Task<bool> IsNameUsedAsync(Guid orgId, string name)
    {
        return await AnyAsync(x =>
            x.OrgId == orgId &&
            string.Equals(x.Name.ToLower(), name.ToLower())
        );
    }

    public async Task<PagedResult<WebhookDelivery>> GetDeliveriesAsync(Guid webhookId, WebhookDeliveryFilter filter)
    {
        var query = SetOf<WebhookDelivery>().Where(x => x.WebhookId == webhookId);

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

    public async Task DeleteAsync(Guid id)
    {
        await DeleteOneAsync(id);

        // delete deliveries
        await SetOf<WebhookDelivery>().Where(x => x.WebhookId == id).ExecuteDeleteAsync();
    }
}