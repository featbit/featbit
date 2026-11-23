using Application.Environments;
using Application.Projects;
using Application.Services;
using AutoMapper;
using Domain.Policies;
using Domain.Projects;
using Domain.Resources;
using MediatR;
using Environment = Domain.Environments.Environment;

namespace Application.UnitTests.Handlers;

public class SecretSanitizationTests
{
    private static PolicyStatement[] Grants(bool read) => [new()
    {
        ResourceType = "env", Effect = EffectType.Allow,
        Actions = read ? [Permissions.CanAccessEnv, Permissions.ViewEnvSecret] : [Permissions.CanAccessEnv],
        Resources = ["project/demo:env/prod"]
    }, new()
    {
        ResourceType = "project", Effect = EffectType.Allow,
        Actions = [Permissions.CanAccessProject], Resources = ["project/demo"]
    }];

    [Theory]
    [InlineData("get", false)]
    [InlineData("get", true)]
    [InlineData("create", false)]
    [InlineData("create", true)]
    [InlineData("update", false)]
    [InlineData("update", true)]
    public async Task EnvironmentHandlersSanitizeAfterPersistenceAndNotifications(string action, bool read)
    {
        var env = new Environment(Guid.NewGuid(), "Production", "prod");
        var service = new Mock<IEnvironmentService>();
        service.Setup(s => s.GetAsync(env.Id)).ReturnsAsync(env);
        service.Setup(s => s.AddWithBuiltInPropsAsync(It.IsAny<Environment>()))
            .Callback<Environment>(e => Assert.Equal(2, e.Secrets.Count)).Returns(Task.CompletedTask);
        service.Setup(s => s.UpdateAsync(It.IsAny<Environment>()))
            .Callback<Environment>(e => Assert.Equal(2, e.Secrets.Count)).Returns(Task.CompletedTask);
        var mapper = new Mock<IMapper>();
        mapper.Setup(m => m.Map<EnvironmentVm>(It.IsAny<object>())).Returns((object value) =>
        {
            var e = (Environment)value;
            return new EnvironmentVm { Id = e.Id.ToString(), Secrets = e.Secrets };
        });
        var resources = new Mock<IResourceService>();
        resources.Setup(r => r.GetEnvRnAsync(It.IsAny<Guid>())).ReturnsAsync("project/demo:env/prod");
        var publisher = new Mock<IPublisher>();
        publisher.Setup(p => p.Publish(It.IsAny<OnEnvironmentAdded>(), It.IsAny<CancellationToken>()))
            .Callback<OnEnvironmentAdded, CancellationToken>((n, _) => Assert.Equal(2, n.Environment.Secrets.Count))
            .Returns(Task.CompletedTask);
        var result = action switch
        {
            "get" => await new GetEnvironmentHandler(service.Object, resources.Object, mapper.Object)
                .Handle(new GetEnvironment { Id = env.Id, Permissions = Grants(read) }, default),
            "create" => await new CreateEnvironmentHandler(service.Object, mapper.Object, publisher.Object, resources.Object)
                .Handle(new CreateEnvironment(env.ProjectId, new CreateEnvironmentPayload { Name = "Production", Key = "prod" }, Grants(read)), default),
            _ => await new UpdateEnvironmentHandler(service.Object, mapper.Object, resources.Object)
                .Handle(new UpdateEnvironment(env.Id, new UpdateEnvironmentPayload { Name = "Production" }, Grants(read)), default)
        };
        Assert.Equal(read ? 2 : 0, result.Secrets.Count);
        Assert.Equal(action == "create" || read ? 2 : 0, env.Secrets.Count);
    }

    [Theory]
    [InlineData("get", false)]
    [InlineData("get", true)]
    [InlineData("list", false)]
    [InlineData("list", true)]
    [InlineData("create", false)]
    [InlineData("create", true)]
    public async Task ProjectHandlersSanitizeAfterNotifications(string action, bool read)
    {
        var env = new Environment(Guid.NewGuid(), "Production", "prod");
        var project = new ProjectWithEnvs { Id = env.ProjectId, Key = "demo", Environments = [env] };
        var service = new Mock<IProjectService>();
        service.Setup(s => s.GetWithEnvsAsync(project.Id)).ReturnsAsync(project);
        service.Setup(s => s.GetListAsync(It.IsAny<Guid>())).ReturnsAsync(new[] { project });
        service.Setup(s => s.AddWithEnvsAsync(It.IsAny<Project>(), It.IsAny<IEnumerable<string>>())).ReturnsAsync(project);
        var publisher = new Mock<IPublisher>();
        publisher.Setup(p => p.Publish(It.IsAny<OnProjectAdded>(), It.IsAny<CancellationToken>()))
            .Callback<OnProjectAdded, CancellationToken>((n, _) => Assert.Equal(2, Assert.Single(n.ProjectWithEnvs.Environments).Secrets.Count))
            .Returns(Task.CompletedTask);
        var result = action switch
        {
            "get" => await new GetProjectHandler(service.Object).Handle(new GetProject { Id = project.Id, Permissions = Grants(read) }, default),
            "list" => Assert.Single(await new GetProjectListHandler(service.Object).Handle(new GetProjectList { Permissions = Grants(read) }, default)),
            _ => await new CreateProjectHandler(service.Object, publisher.Object).Handle(new CreateProject(Guid.NewGuid(), new CreateProjectPayload { Name = "Demo", Key = "demo" }, Grants(read)), default)
        };
        Assert.Equal(read ? 2 : 0, Assert.Single(result.Environments).Secrets.Count);
        Assert.Equal(read ? 2 : 0, env.Secrets.Count);
    }
}
