using System.Linq.Expressions;
using Application.Bases.Models;
using Application.Segments;
using Dapper;
using Domain.Organizations;
using Domain.Projects;
using Domain.Resources;
using Domain.Segments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.EntityFrameworkCore;

public class SegmentService(AppDbContext dbContext, ILogger<SegmentService> logger)
    : EntityFrameworkCoreService<Segment>(dbContext), ISegmentService
{
    public async Task<PagedResult<Segment>> GetListAsync(Guid workspaceId, string rn, SegmentFilter userFilter)
    {
        var query = Queryable
            .Where(
                x => x.WorkspaceId == workspaceId &&
                     x.IsArchived == userFilter.IsArchived &&
                     x.Scopes.Any(y => $"{rn}:".StartsWith(string.Concat(y, ":")))
            );

        // name filter
        var name = userFilter.Name?.ToLower();
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(segment => segment.Name.ToLower().Contains(name));
        }

        var totalCount = await query.CountAsync();
        var itemsQuery = query
            .OrderByDescending(segment => segment.UpdatedAt)
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Take(userFilter.PageSize);

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

        const string sql = """
                           SELECT id as Id, env_id as EnvId, name as Name, key as Key
                           FROM feature_flags
                           WHERE env_id = @envId
                             AND EXISTS (SELECT 1
                                         FROM jsonb_array_elements(rules) AS rule
                                         WHERE EXISTS (SELECT 1
                                                       FROM jsonb_array_elements(rule -> 'conditions') AS condition
                                                       WHERE condition ->> 'property' = ANY(@conditionProperties)
                                                         AND condition ->> 'value' LIKE '%' || @segmentId || '%'));
                           """;

        var parameters = new
        {
            envId,
            conditionProperties = SegmentConsts.ConditionProperties,
            segmentId
        };

        var references = await DbConnection.QueryAsync<FlagReference>(sql, parameters);
        return references.AsList();
    }

    public async ValueTask<ICollection<Guid>> GetEnvironmentIdsAsync(Segment segment)
    {
        if (segment.IsEnvironmentSpecific)
        {
            return [segment.EnvId];
        }

        var envIds = new List<Guid>();
        foreach (var scope in segment.Scopes)
        {
            var (_, scopeEnvIds) = await TranslateScopeAsync(scope);
            envIds.AddRange(scopeEnvIds);
        }

        var distinct = envIds.Distinct().ToArray();
        return distinct;
    }

    public async Task<bool> IsNameUsedAsync(Guid workspaceId, string type, Guid envId, string name)
    {
        Expression<Func<Segment, bool>> predicate = type switch
        {
            SegmentType.Shared => x =>
                x.WorkspaceId == workspaceId &&
                x.Type == SegmentType.Shared &&
                string.Equals(x.Name.ToLower(), name.ToLower()),

            _ => x =>
                x.EnvId == envId &&
                x.Type == SegmentType.EnvironmentSpecific &&
                string.Equals(x.Name.ToLower(), name.ToLower())
        };

        return await AnyAsync(predicate);
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

    public async Task<ICollection<SegmentCache>> GetCachesAsync()
    {
        var segments = await Queryable.ToListAsync();

        var caches = new List<SegmentCache>();

        // environment specific segments
        var envSegments = segments.Where(x => x.Type == SegmentType.EnvironmentSpecific);
        caches.AddRange(envSegments.Select(x => new SegmentCache([x.EnvId], x)));

        // shared segments
        await AddSharedSegmentCachesAsync();

        return caches;

        async Task AddSharedSegmentCachesAsync()
        {
            var sharedSegments = segments.Where(x => x.Type == SegmentType.Shared).ToArray();

            var scopesToTranslate = sharedSegments.SelectMany(x => x.Scopes)
                .Distinct()
                .ToArray();

            var translateScopeTasks = scopesToTranslate.Select(x => TranslateScopeAsync(x));
            var scopes = await Task.WhenAll(translateScopeTasks);

            foreach (var sharedSegment in sharedSegments)
            {
                var envIds = sharedSegment.Scopes
                    .SelectMany(scope => scopes.First(x => x.scope == scope).envIds)
                    .Distinct()
                    .ToArray();

                caches.Add(new SegmentCache(envIds, sharedSegment));
            }
        }
    }

    private async Task<(string scope, ICollection<Guid> envIds)> TranslateScopeAsync(string scope)
    {
        if (!RN.TryParse(scope, out var props))
        {
            logger.LogError("Segment scope '{Scope}' is not a valid RN.", scope);

            return (scope, []);
        }

        var environments = QueryableOf<Environment>();
        var projects = QueryableOf<Project>();
        var organizations = QueryableOf<Organization>();

        var envProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Env);
        if (envProp != null && envProp.Key != "*")
        {
            environments = environments.Where(x => x.Key == envProp.Key);
        }

        var projectProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Project);
        if (projectProp != null && projectProp.Key != "*")
        {
            projects = projects.Where(x => x.Key == projectProp.Key);
        }

        var orgProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Organization);
        if (orgProp != null && orgProp.Key != "*")
        {
            organizations = organizations.Where(x => x.Key == orgProp.Key);
        }

        var query = from env in environments
            join project in projects on env.ProjectId equals project.Id
            join org in organizations on project.OrganizationId equals org.Id
            select env.Id;

        var ids = await query.ToListAsync();
        return (scope, ids);
    }
}