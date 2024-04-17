using Domain.Organizations;
using Domain.Projects;
using Domain.Workspaces;
using MongoDB.Driver;
using Environment = Domain.Environments.Environment;
using MongoDB.Driver.Linq;

namespace Infrastructure.Workspaces;

public class WorkspaceService : MongoDbService<Workspace>, IWorkspaceService
{
    public WorkspaceService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<ICollection<Guid>> GetAllEnvIdsAsync(Guid workspaceId)
    {
        var organizations = MongoDb.QueryableOf<Organization>();
        var projects = MongoDb.QueryableOf<Project>();
        var environments = MongoDb.QueryableOf<Environment>();

        var query = from environment in environments
            join project in projects on environment.ProjectId equals project.Id
            join organization in organizations on project.OrganizationId equals organization.Id
            join workspace in Queryable on organization.WorkspaceId equals workspace.Id
            where workspace.Id == workspaceId
            select environment.Id;

        var envIds = await query.ToListAsync();
        return envIds;
    }

    public async Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key)
    {
        return await AnyAsync(ws =>
            ws.Id != workspaceId &&
            string.Equals(ws.Key, key, StringComparison.OrdinalIgnoreCase)
        );
    }
}