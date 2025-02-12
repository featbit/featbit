using Application.Bases;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.Segments;
using Domain.FeatureFlags;
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
        var name = userFilter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(segment => segment.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
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

        var query = QueryableOf<FeatureFlag>().Where(flag =>
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
            return ids;
        }
    }
}