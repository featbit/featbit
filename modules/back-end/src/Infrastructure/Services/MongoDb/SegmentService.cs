using System.Linq.Expressions;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.Segments;
using Domain.FeatureFlags;
using Domain.Resources;
using Domain.Segments;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.MongoDb;

public class SegmentService(MongoDbClient mongoDb, ILogger<SegmentService> logger)
    : MongoDbService<Segment>(mongoDb), ISegmentService
{
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

    public async Task<ICollection<Guid>> GetEnvironmentIdsAsync(Segment segment)
    {
        if (segment.IsEnvironmentSpecific)
        {
            return [segment.EnvId];
        }

        var envIds = new List<Guid>();
        foreach (var scope in segment.Scopes)
        {
            var scopeEnvIds = await SearchScope(scope);
            envIds.AddRange(scopeEnvIds);
        }

        return envIds;

        async Task<ICollection<Guid>> SearchScope(string scope)
        {
            if (!RN.TryParse(scope, out var props))
            {
                logger.LogError(
                    "Inconsistent segment data for {Segment}: the scope '{Scope}' is not a valid RN.",
                    segment.Id,
                    scope
                );

                throw new BusinessException(ErrorCodes.InconsistentData);
            }

            var match = new Dictionary<string, string>();

            var envProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Env);
            if (envProp != null && envProp.Key != "*")
            {
                match.Add("key", envProp.Key);
            }

            var projectProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Project);
            if (projectProp != null && projectProp.Key != "*")
            {
                match.Add("projects.key", projectProp.Key);
            }

            var orgProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Organization);
            if (orgProp != null && orgProp.Key != "*")
            {
                match.Add("organizations.key", orgProp.Key);
            }

            var query = MongoDb.CollectionOf<Environment>().Aggregate()
                .Lookup("Projects", "projectId", "_id", "projects")
                .Unwind("projects")
                .Lookup("Organizations", "projects.organizationId", "_id", "organizations")
                .Unwind("organizations")
                .Match(new BsonDocument
                {
                    {
                        "$and",
                        new BsonArray(match.Select(x => new BsonDocument(x.Key, x.Value)))
                    }
                })
                .Project(new BsonDocument("_id", 1));

            var documents = await query.ToListAsync();
            return documents.Select(x => x["_id"].AsGuid).ToList();
        }
    }

    public async Task<bool> IsNameUsedAsync(Guid workspaceId, string type, Guid envId, string name)
    {
        Expression<Func<Segment, bool>> predicate = type switch
        {
            SegmentType.Shared => x =>
                x.WorkspaceId == workspaceId &&
                x.Type == SegmentType.Shared &&
                string.Equals(x.Name, name, StringComparison.OrdinalIgnoreCase),

            _ => x =>
                x.EnvId == envId &&
                x.Type == SegmentType.EnvironmentSpecific &&
                string.Equals(x.Name, name, StringComparison.OrdinalIgnoreCase)
        };

        return await AnyAsync(predicate);
    }
}