using Domain.Projects;
using MongoDB.Driver;
using Environment = Domain.Environments.Environment;
using MongoDB.Driver.Linq;

namespace Infrastructure.Projects;

public class ProjectService : MongoDbService<Project>, IProjectService
{
    private readonly IEnvironmentService _envService;

    public ProjectService(MongoDbClient mongoDb, IEnvironmentService envService) : base(mongoDb)
    {
        _envService = envService;
    }

    public async Task<ProjectWithEnvs> GetWithEnvsAsync(Guid id)
    {
        var projects = MongoDb.QueryableOf<Project>();
        var envs = MongoDb.QueryableOf<Environment>();

        var query =
            from project in projects
            join env in envs
                on project.Id equals env.ProjectId into allEnvs
            where project.Id == id
            select new ProjectWithEnvs
            {
                Id = project.Id,
                Name = project.Name,
                Key = project.Key,
                Environments = allEnvs
            };

        return await query.FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<ProjectWithEnvs>> GetListAsync(Guid organizationId)
    {
        var projects = MongoDb.QueryableOf<Project>();
        var envs = MongoDb.QueryableOf<Environment>();

        var query =
            from project in projects
            join env in envs
                on project.Id equals env.ProjectId into allEnvs
            where project.OrganizationId == organizationId
            orderby project.CreatedAt descending
            select new ProjectWithEnvs
            {
                Id = project.Id,
                Name = project.Name,
                Key = project.Key,
                Environments = allEnvs
            };

        return await query.ToListAsync();
    }

    public async Task<ProjectWithEnvs> AddWithEnvsAsync(Project project, IEnumerable<string> envNames)
    {
        // add project
        await MongoDb.CollectionOf<Project>().InsertOneAsync(project);

        // add environments
        var envs = envNames
            .Select(envName => new Environment(project.Id, envName, envName.ToLower()))
            .ToArray();
        await _envService.AddManyWithBuiltInPropsAsync(envs);

        return new ProjectWithEnvs
        {
            Id = project.Id,
            Name = project.Name,
            Key = project.Key,
            Environments = envs
        };
    }

    public async Task<bool> HasKeyBeenUsedAsync(Guid organizationId, string key)
    {
        return await AnyAsync(project =>
            project.OrganizationId == organizationId &&
            string.Equals(project.Key, key, StringComparison.OrdinalIgnoreCase)
        );
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        // delete project
        await MongoDb.CollectionOf<Project>().DeleteOneAsync(x => x.Id == id);

        // delete environments
        var envIds = await MongoDb.QueryableOf<Environment>()
            .Where(x => x.ProjectId == id)
            .Select(x => x.Id)
            .ToListAsync();
        await _envService.DeleteManyAsync(envIds);

        return true;
    }

    public async Task DeleteManyAsync(ICollection<Guid> projectIds)
    {
        // delete projects
        await MongoDb.CollectionOf<Project>().DeleteManyAsync(x => projectIds.Contains(x.Id));

        // delete environments
        var envIds = await MongoDb.QueryableOf<Environment>()
            .Where(x => projectIds.Contains(x.ProjectId))
            .Select(x => x.Id)
            .ToListAsync();
        await _envService.DeleteManyAsync(envIds);
    }
}