using Dapper;
using Domain.Workspaces;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class WorkspaceService(AppDbContext dbContext)
    : EntityFrameworkCoreService<Workspace>(dbContext), IWorkspaceService
{
    public async Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key)
    {
        return await AnyAsync(ws =>
            ws.Id != workspaceId &&
            string.Equals(ws.Key.ToLower(), key.ToLower())
        );
    }

    public async Task<string> GetDefaultWorkspaceAsync()
    {
        if (await Queryable.CountAsync() != 1)
        {
            return string.Empty;
        }

        var first = await Queryable.FirstAsync();
        return first.Key;
    }

    public async Task<int> GetUsageAsync(Guid workspaceId, string feature)
    {
        if (!LicenseFeatures.UsageFeatures.Contains(feature))
        {
            return 0;
        }

        return feature switch
        {
            LicenseFeatures.AutoAgents => await GetAutoAgentsUsageAsync(),
            _ => 0
        };

        async Task<int> GetAutoAgentsUsageAsync()
        {
            var usage = await DbConnection.ExecuteScalarAsync<int>(
                """
                select coalesce(sum(jsonb_array_length(auto_agents)), 0)
                from relay_proxies rp
                         join organizations org on rp.organization_id = org.id
                where org.workspace_id = @WorkspaceId
                """, new { WorkspaceId = workspaceId }
            );

            return usage;
        }
    }
}