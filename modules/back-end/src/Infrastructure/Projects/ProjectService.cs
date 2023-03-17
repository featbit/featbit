using Domain.EndUsers;
using Domain.Projects;
using MongoDB.Driver;
using Environment = Domain.Environments.Environment;
using MongoDB.Driver.Linq;

namespace Infrastructure.Projects;

public class ProjectService : MongoDbService<Project>, IProjectService
{
    public ProjectService(MongoDbClient mongoDb) : base(mongoDb)
    {
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
                Environments = allEnvs
            };

        return await query.ToListAsync();
    }

    public async Task<ProjectWithEnvs> AddWithEnvsAsync(Project project, IEnumerable<string> envNames)
    {
        await MongoDb.CollectionOf<Project>().InsertOneAsync(project);

        var envs = envNames.Select(envName => new Environment(project.Id, envName, envName.ToLower())).ToList();
        await MongoDb.CollectionOf<Environment>().InsertManyAsync(envs);

        // add env built-in end-user properties
        var builtInProperties = envs.SelectMany(x => EndUserConsts.BuiltInUserProperties(x.Id));
        await MongoDb.CollectionOf<EndUserProperty>().InsertManyAsync(builtInProperties);

        return new ProjectWithEnvs
        {
            Id = project.Id,
            Name = project.Name,
            Environments = envs
        };
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        // delete project
        await MongoDb.CollectionOf<Project>().DeleteOneAsync(x => x.Id == id);

        // delete all related environments
        await MongoDb.CollectionOf<Environment>().DeleteManyAsync(x => x.ProjectId == id);

        return true;
    }
}