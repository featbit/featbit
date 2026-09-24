using System.Linq.Expressions;
using System.Security.Cryptography;
using System.Text.Json;
using Application.Bases.Exceptions;
using Application.ReleaseHealth;
using Application.Services;
using Domain.Projects;
using Infrastructure.ReleaseHealth;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;
using Env = Domain.Environments.Environment;

namespace Infrastructure.UnitTests.ReleaseHealth;

public class MonitorWebhookTests
{
    private readonly Guid org = Guid.NewGuid();
    private readonly MemoryStore store = new();
    private readonly Project project;
    private readonly Env env;
    private readonly ReleaseHealthService service;
    public MonitorWebhookTests()
    {
        project = new Project(org, "Shop", "shop") { Id = Guid.NewGuid() };
        env = new Env(project.Id, "Prod", "prod");
        var projects = new Mock<IProjectService>();
        projects.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Project, bool>>>()))
            .ReturnsAsync((Expression<Func<Project, bool>> filter) => filter.Compile()(project) ? project : null);
        var environments = new Mock<IEnvironmentService>();
        environments.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Env, bool>>>()))
            .ReturnsAsync((Expression<Func<Env, bool>> filter) => filter.Compile()(env) ? env : null);
        environments.Setup(x => x.AnyAsync(It.IsAny<Expression<Func<Env, bool>>>()))
            .ReturnsAsync((Expression<Func<Env, bool>> filter) => filter.Compile()(env));
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ReleaseHealth:Credentials:ActiveKeyId"] = "test",
            ["ReleaseHealth:Credentials:Keys:test"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
        }).Build();
        service = new(store, new AesCredentialProtector(config), [], environments.Object, projects.Object, NullLogger<ReleaseHealthService>.Instance);
    }

    private MonitorWebhookWrite Draft() => new("Operations", "https://example.com/alerts", true, [$"{project.Id}/{env.Id}"],
        "custom", "{\"type\":\"{{event.type}}\",\"value\":{{evaluation.value}},\"at\":{{alert.recoveredAt}},\"unit\":{{metric.resultContract.unit}}}",
        new("replace", [new("Authorization", "Bearer confidential-header")]), new("replace", "confidential-secret"), null);

    [Fact]
    public async Task SaveAndReloadUsesServerDocumentsAndWriteOnlyEncryptedCredentials()
    {
        var saved = await service.SaveMonitorWebhook(org, null, Draft(), Guid.NewGuid(), default);
        var document = Assert.Single(store.Documents.Values);
        Assert.DoesNotContain("confidential", document.Payload);
        Assert.DoesNotContain("confidential", document.ProtectedSecrets);
        Assert.NotNull(document.ProtectedSecrets);
        var read = Assert.Single(await service.MonitorWebhooks(org, default));
        Assert.Equal(JsonSerializer.Serialize(saved), JsonSerializer.Serialize(read));
        Assert.True(read.HasHeaders);
        Assert.True(read.HasSecret);
        Assert.DoesNotContain("confidential", JsonSerializer.Serialize(read));
        Assert.Empty(await service.MonitorWebhooks(Guid.NewGuid(), default));
        await service.ValidateMonitorWebhook(org, project.Id, env.Id, saved.Id, default);
        await Assert.ThrowsAsync<BusinessException>(() => service.ValidateMonitorWebhook(Guid.NewGuid(), project.Id, env.Id, saved.Id, default));
        await Assert.ThrowsAsync<BusinessException>(() => service.ValidateMonitorWebhook(org, project.Id, Guid.NewGuid(), saved.Id, default));
    }

    [Fact]
    public async Task EditsKeepOrRemoveCredentialsExplicitlyAndStaleWritesCannotOverwrite()
    {
        var saved = await service.SaveMonitorWebhook(org, null, Draft(), Guid.NewGuid(), default);
        var keep = Draft() with { Name = "Updated", ExpectedVersion = saved.Version, HeadersUpdate = new("keep"), SecretUpdate = new("keep") };
        var changed = await service.SaveMonitorWebhook(org, saved.Id, keep, Guid.NewGuid(), default);
        Assert.Equal(2, changed.Version);
        Assert.True(changed.HasSecret);
        Assert.True(changed.HasHeaders);
        await Assert.ThrowsAsync<ConflictException>(() => service.SaveMonitorWebhook(org, saved.Id, keep, Guid.NewGuid(), default));
        var removed = await service.SaveMonitorWebhook(org, saved.Id, keep with { ExpectedVersion = changed.Version, HeadersUpdate = new("remove"), SecretUpdate = new("remove") }, Guid.NewGuid(), default);
        Assert.False(removed.HasHeaders);
        Assert.False(removed.HasSecret);
        Assert.Null(Assert.Single(store.Documents.Values).ProtectedSecrets);
    }

    [Fact]
    public async Task SoftDeleteRetainsIdentityAndMakesReferencesUnavailableWithoutDeletingBindings()
    {
        var saved = await service.SaveMonitorWebhook(org, null, Draft(), Guid.NewGuid(), default);
        await Assert.ThrowsAsync<ConflictException>(() => service.RemoveMonitorWebhook(org, saved.Id, 99, Guid.NewGuid(), default));
        await service.RemoveMonitorWebhook(org, saved.Id, saved.Version, Guid.NewGuid(), default);
        Assert.Empty(await service.MonitorWebhooks(org, default));
        Assert.Equal(saved.Id, Assert.Single(store.Documents.Values).Id);
        Assert.Contains("\"isDeleted\":true", Assert.Single(store.Documents.Values).Payload);
        await Assert.ThrowsAsync<BusinessException>(() => service.ValidateMonitorWebhook(org, project.Id, env.Id, saved.Id, default));
    }

    [Fact]
    public async Task InactiveAndInvalidScopesAndDuplicateNamesAreRejected()
    {
        var saved = await service.SaveMonitorWebhook(org, null, Draft() with { IsActive = false }, Guid.NewGuid(), default);
        await Assert.ThrowsAsync<BusinessException>(() => service.ValidateMonitorWebhook(org, project.Id, env.Id, saved.Id, default));
        await Assert.ThrowsAsync<BusinessException>(() => service.SaveMonitorWebhook(org, null, Draft() with { Name = " operations " }, Guid.NewGuid(), default));
        await Assert.ThrowsAsync<EntityNotFoundException>(() => service.SaveMonitorWebhook(org, null, Draft() with { Name = "Other", Scopes = [$"{Guid.NewGuid()}/{env.Id}"] }, Guid.NewGuid(), default));
        await Assert.ThrowsAsync<EntityNotFoundException>(() => service.SaveMonitorWebhook(org, null, Draft() with { Name = "Other", Scopes = [$"{project.Id}/{Guid.NewGuid()}"] }, Guid.NewGuid(), default));
    }

    [Theory]
    [InlineData("Bad Name", "value")]
    [InlineData("Authorization", "token\r\nInjected: yes")]
    [InlineData("Authorization", "token\0")]
    public async Task MalformedHeadersAreNeverPersisted(string key, string value)
    {
        await Assert.ThrowsAsync<BusinessException>(() => service.SaveMonitorWebhook(org, null, Draft() with { HeadersUpdate = new("replace", [new(key, value)]) }, Guid.NewGuid(), default));
        Assert.Empty(store.Documents);
    }

    [Theory]
    [InlineData("{\"value\":{{evaluation.value}},\"flag\":\"{{flag.name}}\",\"at\":{{alert.recoveredAt}}}")]
    [InlineData("{\"evaluation\":{{json evaluation}},\"unit\":{{metric.resultContract.unit}}}")]
    [InlineData("{{#if (eq event.type \"alert.recovered\")}}{\"at\":{{alert.recoveredAt}}}{{else}}{}{{/if}}")]
    public void ValidatesTypedVariablesEscapesAndBothEventBranches(string template) => MonitorWebhookTemplate.Validate(template);

    [Theory]
    [InlineData("[]")]
    [InlineData("{\"private\":{{secret}}}")]
    [InlineData("{{#if (eq event.type \"alert.recovered\")}}invalid{{else}}{}{{/if}}")]
    [InlineData("{{#if (eq metric.resultContract.unit.numerator \"errors\")}}invalid{{else}}{}{{/if}}")]
    [InlineData("{{#if (eq rule.severity \"warning\")}}invalid{{else}}{}{{/if}}")]
    public void RejectsInvalidSamplesAndUnknownVariables(string template) => Assert.Throws<BusinessException>(() => MonitorWebhookTemplate.Validate(template));

    private sealed class MemoryStore : IReleaseHealthStore
    {
        public Dictionary<(Guid, string, Guid), ReleaseHealthDocument> Documents { get; } = [];
        public Task<IReadOnlyList<ReleaseHealthDocument>> ListAsync(Guid scope, string kind, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<ReleaseHealthDocument>>(Documents.Values.Where(x => x.ScopeId == scope && x.Kind == kind).ToArray());
        public Task<ReleaseHealthDocument?> FindAsync(Guid scope, string kind, Guid id, CancellationToken ct) => Task.FromResult(Documents.GetValueOrDefault((scope, kind, id)));
        public Task PutAsync(ReleaseHealthDocument value, long? version, CancellationToken ct)
        {
            var key = (value.ScopeId, value.Kind, value.Id);
            if (Documents.GetValueOrDefault(key)?.Version != version) throw new ConflictException("ReleaseHealth", value.Id);
            Documents[key] = value;
            return Task.CompletedTask;
        }
    }
}
