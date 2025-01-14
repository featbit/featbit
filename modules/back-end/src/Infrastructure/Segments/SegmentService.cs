using Application.Bases.Models;
using Application.Segments;
using Domain.FeatureFlags;
using Domain.Segments;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Segments;

public class SegmentService : MongoDbService<Segment>, ISegmentService
{
    public SegmentService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<PagedResult<Segment>> GetListAsync(Guid workspaceId, string rn, SegmentFilter userFilter)
    {
        var filterBuilder = Builders<Segment>.Filter;

        var filters = new List<FilterDefinition<Segment>>
        {
            // workspace filter
            filterBuilder.Where(x => x.WorkspaceId == workspaceId),

            // rn filter
            filterBuilder.Where(x => x.Scopes.Any(y => $"{rn}:".StartsWith(string.Concat(y, ":"))))
        };

        // name filter
        var name = userFilter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            var nameFilter = filterBuilder.Where(
                segment => segment.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase)
            );
            filters.Add(nameFilter);
        }

        // archived filter
        var isArchivedFilter = filterBuilder.Eq(segment => segment.IsArchived, userFilter.IsArchived);
        filters.Add(isArchivedFilter);

        var filter = filterBuilder.And(filters);

        var totalCount = await Collection.CountDocumentsAsync(filter);
        var itemsQuery = Collection
            .Find(filter)
            .SortByDescending(segment => segment.UpdatedAt)
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Limit(userFilter.PageSize);

        var items = await itemsQuery.ToListAsync();

        return new PagedResult<Segment>(totalCount, items);
    }

    public async Task<ICollection<Segment>> GetListAsync(Guid workspaceId, string rn, bool includeArchived = false)
    {
        var query = Queryable
            .Where(x => x.WorkspaceId == workspaceId && x.Scopes.Any(y => $"{rn}:".StartsWith(string.Concat(y, ":"))));

        if (!includeArchived)
        {
            query = query.Where(x => !x.IsArchived);
        }

        return await query.ToListAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        await Collection.DeleteOneAsync(x => x.Id == id);
    }

    public async Task<ICollection<FlagReference>> GetFlagReferencesAsync(Guid envId, Guid id)
    {
        var segmentId = id.ToString();

        var query = MongoDb.QueryableOf<FeatureFlag>().Where(flag =>
            flag.EnvId == envId &&
            flag.Rules.Any(rule =>
                rule.Conditions.Any(condition =>
                    SegmentConsts.ConditionProperties.Contains(condition.Property) &&
                    condition.Value.Contains(segmentId)
                )
            )
        ).Select(x => new FlagReference
        {
            Id = x.Id,
            Name = x.Name,
            Key = x.Key
        });

        var references = await query.ToListAsync();
        foreach (var reference in references)
        {
            reference.EnvId = envId;
        }

        return references;
    }
}