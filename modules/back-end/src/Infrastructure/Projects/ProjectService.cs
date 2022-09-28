using Application.Services;
using Domain.Projects;
using Infrastructure.MongoDb;
using MongoDB.Driver;
using Environment = Domain.Environments.Environment;
using MongoDB.Driver.Linq;

namespace Infrastructure.Projects;

public class ProjectService : IProjectService
{
    private readonly MongoDbClient _mongoDb;

    public ProjectService(MongoDbClient mongoDb)
    {
        _mongoDb = mongoDb;
    }

    public async Task<ProjectWithEnvs> GetAsync(Guid id)
    {
        var projects = _mongoDb.QueryableOf<Project>();
        var envs = _mongoDb.QueryableOf<Environment>();

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
        var projects = _mongoDb.QueryableOf<Project>();
        var envs = _mongoDb.QueryableOf<Environment>();

        var query =
            from project in projects
            join env in envs
                on project.Id equals env.ProjectId into allEnvs
            where project.OrganizationId == organizationId
            select new ProjectWithEnvs
            {
                Id = project.Id,
                Name = project.Name,
                Environments = allEnvs
            };

        return await query.ToListAsync();
    }
}