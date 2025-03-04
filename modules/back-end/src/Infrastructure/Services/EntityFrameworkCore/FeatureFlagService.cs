using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class FeatureFlagService(AppDbContext dbContext)
    : EntityFrameworkCoreService<FeatureFlag>(dbContext), IFeatureFlagService
{
    public async Task<PagedResult<FeatureFlag>> GetListAsync(Guid envId, FeatureFlagFilter userFilter)
    {
        var query = Queryable.Where(x => x.EnvId == envId && x.IsArchived == userFilter.IsArchived);

        // name/key filter
        var nameOrKey = userFilter.Name?.ToLower();
        if (!string.IsNullOrWhiteSpace(nameOrKey))
        {
            query = query.Where(flag => flag.Name.ToLower().Contains(nameOrKey) || flag.Key.ToLower().Contains(nameOrKey));
        }

        // isEnabled filter
        var isEnabled = userFilter.IsEnabled;
        if (isEnabled.HasValue)
        {
            query = query.Where(flag => flag.IsEnabled == isEnabled.Value);
        }

        // tags filter
        if (userFilter.Tags.Any())
        {
            query = query.Where(x => userFilter.Tags.All(y => x.Tags.Contains(y)));
        }

        var totalCount = await query.CountAsync();

        var itemsQuery = query
            .OrderByDescending(x => x.UpdatedAt)
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Take(userFilter.PageSize);

        var items = await itemsQuery.ToListAsync();

        return new PagedResult<FeatureFlag>(totalCount, items);
    }

    public async Task<FeatureFlag> GetAsync(Guid envId, string key)
    {
        var flag = await FindOneAsync(x => x.EnvId == envId && x.Key == key);
        if (flag == null)
        {
            throw new EntityNotFoundException(nameof(FeatureFlag), $"{envId}-{key}");
        }

        return flag;
    }

    public async Task<bool> HasKeyBeenUsedAsync(Guid envId, string key)
    {
        return await AnyAsync(flag =>
            flag.EnvId == envId &&
            string.Equals(flag.Key.ToLower(), key.ToLower())
        );
    }

    public async Task<ICollection<string>> GetAllTagsAsync(Guid envId)
    {
        // https://github.com/npgsql/efcore.pg/issues/1525
        // https://github.com/dotnet/efcore/issues/32505
        // SelectMany is not supported in efcore 8.x

        var allTags = await Queryable
            .Where(x => x.EnvId == envId && !x.IsArchived)
            .Select(x => x.Tags)
            .ToListAsync();

        return allTags.SelectMany(x => x).Distinct().ToArray();
    }
}