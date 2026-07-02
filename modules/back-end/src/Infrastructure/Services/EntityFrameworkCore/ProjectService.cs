using Domain.Projects;
using Microsoft.EntityFrameworkCore;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ProjectService(AppDbContext dbContext, IEnvironmentService envService)
    : EntityFrameworkCoreService<Project>(dbContext), IProjectService
{
    public async Task<ProjectWithEnvs?> GetWithEnvsAsync(Guid id)
    {
        var projects = QueryableOf<Project>();
        var envs = QueryableOf<Environment>();

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
        var projects = QueryableOf<Project>();
        var envs = QueryableOf<Environment>();

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
        await AddOneAsync(project);

        // add environments
        var envs = envNames
            .Select(envName => new Environment(project.Id, envName, envName.ToLower()))
            .ToArray();
        await envService.AddManyWithBuiltInPropsAsync(envs);

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
            string.Equals(project.Key.ToLower(), key.ToLower())
        );
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        // delete project
        await DeleteOneAsync(id);

        // delete environments
        var envIds = await QueryableOf<Environment>()
            .Where(x => x.ProjectId == id)
            .Select(x => x.Id)
            .ToListAsync();
        await envService.DeleteManyAsync(envIds);

        return true;
    }

    public async Task DeleteManyAsync(ICollection<Guid> projectIds)
    {
        // delete projects
        await Set.Where(x => projectIds.Contains(x.Id)).ExecuteDeleteAsync();

        // delete environments
        var envIds = await QueryableOf<Environment>()
            .Where(x => projectIds.Contains(x.ProjectId))
            .Select(x => x.Id)
            .ToListAsync();
        await envService.DeleteManyAsync(envIds);
    }
}