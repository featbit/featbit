using Application.AuditLogs;
using Application.Bases.Models;
using Dapper;
using Domain.AuditLogs;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class AuditLogService(AppDbContext dbContext) : EntityFrameworkCoreService<AuditLog>(dbContext), IAuditLogService
{
    public async Task<PagedResult<AuditLog>> GetListAsync(Guid workspaceId, Guid envId, AuditLogFilter userFilter)
    {
        var queryable = Queryable.Where(x =>
            x.WorkspaceId == workspaceId &&
            (x.RefType == AuditLogRefTypes.FeatureFlag || x.RefType == AuditLogRefTypes.Segment)
        );

        // env filter, by default we only query logs in the specified environment
        var crossEnvironment = userFilter.CrossEnvironment ?? false;
        if (!crossEnvironment)
        {
            queryable = queryable.Where(x => x.EnvId == envId);
        }

        // query(keyword/comment) filter
        var query = userFilter.Query?.ToLower();
        if (!string.IsNullOrWhiteSpace(query))
        {
            queryable = queryable.Where(x =>
                x.Keyword.ToLower().Contains(query) || x.Comment.ToLower().Contains(query)
            );
        }

        // creator filter
        var creator = userFilter.CreatorId;
        if (creator.HasValue)
        {
            queryable = queryable.Where(x => x.CreatorId == creator.Value);
        }

        // refId filter
        var refId = userFilter.RefId;
        if (!string.IsNullOrWhiteSpace(refId))
        {
            queryable = queryable.Where(x => x.RefId == refId);
        }

        // refType filter
        var refType = userFilter.RefType;
        if (!string.IsNullOrWhiteSpace(refType))
        {
            queryable = queryable.Where(x => x.RefType == refType);
        }

        // data-range filter
        var from = userFilter.From;
        var to = userFilter.To;
        if (from.HasValue)
        {
            var fromDate = DateTimeOffset.FromUnixTimeMilliseconds(from.Value).UtcDateTime;
            queryable = queryable.Where(x => x.CreatedAt >= fromDate);
        }

        if (to.HasValue)
        {
            var toDate = DateTimeOffset.FromUnixTimeMilliseconds(to.Value).UtcDateTime;
            queryable = queryable.Where(x => x.CreatedAt <= toDate);
        }

        var totalCount = await queryable.CountAsync();

        var items = await queryable
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Take(userFilter.PageSize)
            .ToListAsync();

        return new PagedResult<AuditLog>(totalCount, items);
    }

    public async Task<PagedResult<AuditLog>> GetListAsync(Guid workspaceId, AuditLogQueryFilter filter)
    {
        var queryable = Queryable.Where(x => x.WorkspaceId == workspaceId);

        // scope filter
        var scopeId = filter.ScopeId;
        queryable = filter.Scope switch
        {
            AuditLogScopes.Environment => filter.CrossEnvironment == true
                ? queryable
                : queryable.Where(x => x.EnvId == scopeId),
            AuditLogScopes.Organization => queryable.Where(x => x.OrganizationId == scopeId),
            AuditLogScopes.Workspace => queryable.Where(x => x.WorkspaceId == scopeId),

            _ => throw new ArgumentOutOfRangeException(nameof(filter.Scope))
        };

        // refId filter
        var refId = filter.RefId;
        if (!string.IsNullOrWhiteSpace(refId))
        {
            queryable = queryable.Where(x => x.RefId == refId);
        }

        // refType filter
        if (filter.RefTypes.Length > 0)
        {
            queryable = queryable.Where(x => filter.RefTypes.Contains(x.RefType));
        }

        // query(keyword/comment) filter
        var query = filter.Query?.ToLower();
        if (!string.IsNullOrWhiteSpace(query))
        {
            queryable = queryable.Where(x =>
                x.Keyword.ToLower().Contains(query) || x.Comment.ToLower().Contains(query)
            );
        }

        // creator filter
        var creator = filter.CreatorId;
        if (creator.HasValue)
        {
            queryable = queryable.Where(x => x.CreatorId == creator.Value);
        }

        // data-range filter
        var from = filter.From;
        var to = filter.To;
        if (from.HasValue)
        {
            var fromDate = DateTimeOffset.FromUnixTimeMilliseconds(from.Value).UtcDateTime;
            queryable = queryable.Where(x => x.CreatedAt >= fromDate);
        }

        if (to.HasValue)
        {
            var toDate = DateTimeOffset.FromUnixTimeMilliseconds(to.Value).UtcDateTime;
            queryable = queryable.Where(x => x.CreatedAt <= toDate);
        }

        var totalCount = await queryable.CountAsync();

        var items = await queryable
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .Skip(filter.PageIndex * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<AuditLog>(totalCount, items);
    }

    public async Task<LastChange?> GetLastChangeAsync(Guid workspaceId, Guid envId, string refType, string refId)
    {
        var lastChange = await Queryable.Where(x =>
                x.WorkspaceId == workspaceId &&
                x.EnvId == envId &&
                x.RefType == refType &&
                x.RefId == refId &&
                x.Operation != Operations.Create
            )
            .Select(x => new LastChange
            {
                OperatorId = x.CreatorId,
                HappenedAt = x.CreatedAt,
                Comment = x.Comment
            })
            .OrderByDescending(x => x.HappenedAt)
            .FirstOrDefaultAsync();

        return lastChange;
    }

    public async Task<ICollection<LastChange>> GetLastChangesAsync(
        Guid workspaceId,
        Guid envId,
        string refType,
        ICollection<string> refIds)
    {
        const string sql =
            """
            SELECT ref_id AS RefId, creator_id AS OperatorId, created_at AS HappenedAt, comment AS Comment
            FROM (
                SELECT
                    creator_id,
                    created_at,
                    comment,
                    ref_id,
                    row_number() over(partition by ref_id order by created_at desc) AS rn
                FROM audit_logs
                WHERE workspace_id = @workspaceId AND env_id = @envId AND ref_type = @refType AND ref_id = ANY (@refIds) AND operation != 'Create'
            ) AS ranked
            WHERE rn = 1
            """;

        var parameters = new
        {
            workspaceId,
            envId,
            refType,
            refIds
        };

        var lastChanges = await DbConnection.QueryAsync<LastChange>(sql, parameters);
        return lastChanges.AsList();
    }
}
