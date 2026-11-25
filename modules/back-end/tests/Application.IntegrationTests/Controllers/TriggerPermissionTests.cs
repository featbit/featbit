using System.Linq.Expressions;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Bases.Exceptions;
using Application.Services;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;
using Domain.Triggers;
using MediatR;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class TriggerPermissionTests
{
    private const string Route = "/api/v1/triggers";

    public static IEnumerable<object[]> DeniedWrites =>
        from operation in new[] { "create", "update", "reset", "delete" }
        from access in new[] { "read-only", "no-env", "foreign", "denied-toggle" }
        select new object[] { operation, access };

    [Theory]
    [InlineData("read-only", HttpStatusCode.OK)]
    [InlineData("no-env", HttpStatusCode.Forbidden)]
    [InlineData("foreign", HttpStatusCode.Forbidden)]
    public async Task ListRequiresAccessToTargetEnvironment(string access, HttpStatusCode status)
    {
        await using var app = new TriggerTestApp(access);
        using var client = await app.CreateAuthenticatedClientAsync();
        using var response = await client.GetAsync($"{Route}?targetId={app.Flag.Id}");

        Assert.Equal(status, response.StatusCode);
        if (status == HttpStatusCode.OK)
        {
            using var payload = await response.Content.ReadFromJsonAsync<JsonDocument>();
            var trigger = Assert.Single(payload!.RootElement.GetProperty("data").EnumerateArray());
            Assert.Equal(app.Trigger.Id, trigger.GetProperty("id").GetGuid());
            Assert.Contains("***", trigger.GetProperty("token").GetString());
        }
    }

    [Theory]
    [MemberData(nameof(DeniedWrites))]
    public async Task DeniedWritesLeaveTriggersUnchanged(string operation, string access)
    {
        await using var app = new TriggerTestApp(access);
        using var client = await app.CreateAuthenticatedClientAsync();
        var before = JsonSerializer.Serialize(app.Trigger);

        using var response = await WriteAsync(client, operation, app.Flag.Id, app.Trigger.Id);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(before, JsonSerializer.Serialize(Assert.Single(app.StoredTriggers.Values)));
        app.Triggers.Verify(x => x.AddOneAsync(It.IsAny<Trigger>()), Times.Never);
        app.Triggers.Verify(x => x.UpdateAsync(It.IsAny<Trigger>()), Times.Never);
        app.Triggers.Verify(x => x.DeleteOneAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Theory]
    [InlineData("create")]
    [InlineData("update")]
    [InlineData("reset")]
    [InlineData("delete")]
    public async Task AuthorizedWritesPersistRequestedChanges(string operation)
    {
        await using var app = new TriggerTestApp("write");
        using var client = await app.CreateAuthenticatedClientAsync();
        var token = app.Trigger.Token;

        using var response = await WriteAsync(client, operation, app.Flag.Id, app.Trigger.Id);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        switch (operation)
        {
            case "create":
                var created = Assert.Single(app.StoredTriggers.Values, x => x.Id != app.Trigger.Id);
                Assert.Equal(app.Flag.Id, created.TargetId);
                Assert.Equal(TriggerActions.TurnOff, created.Action);
                break;
            case "update":
                Assert.False(app.StoredTriggers[app.Trigger.Id].IsEnabled);
                app.Triggers.Verify(x => x.UpdateAsync(app.Trigger), Times.Once);
                break;
            case "reset":
                using (var payload = await response.Content.ReadFromJsonAsync<JsonDocument>())
                {
                    var updatedToken = app.StoredTriggers[app.Trigger.Id].Token;
                    Assert.NotEqual(token, updatedToken);
                    Assert.Equal(updatedToken, payload!.RootElement.GetProperty("data").GetString());
                }
                app.Triggers.Verify(x => x.UpdateAsync(app.Trigger), Times.Once);
                break;
            case "delete":
                Assert.Empty(app.StoredTriggers);
                break;
        }
    }

    private static Task<HttpResponseMessage> WriteAsync(HttpClient client, string operation, Guid flagId, Guid triggerId) =>
        operation switch
        {
            "create" => client.PostAsJsonAsync(Route, new
            {
                targetId = flagId, type = TriggerTypes.FfGeneral, action = TriggerActions.TurnOff, description = "new trigger"
            }),
            "update" => client.PutAsJsonAsync($"{Route}/{triggerId}", new { isEnabled = false }),
            "reset" => client.PutAsync($"{Route}/{triggerId}/reset-token", null),
            "delete" => client.DeleteAsync($"{Route}/{triggerId}"),
            _ => throw new ArgumentOutOfRangeException(nameof(operation))
        };

    private sealed class TriggerTestApp : PermissionCheckTestApp
    {
        private const string EnvironmentRn = "project/p:env/e";
        private const string FlagRn = EnvironmentRn + ":flag/flag";
        private readonly string _access;

        public FeatureFlag Flag { get; } = new(Guid.NewGuid(), "Flag", "", "flag", false, VariationTypes.Boolean,
            [new() { Id = "off", Value = "false" }, new() { Id = "on", Value = "true" }],
            "off", "on", [], Guid.NewGuid()) { Id = Guid.NewGuid() };
        public Trigger Trigger { get; }
        public Dictionary<Guid, Trigger> StoredTriggers { get; }
        public Mock<ITriggerService> Triggers { get; } = new();

        public TriggerTestApp(string access)
        {
            _access = access;
            Trigger = new Trigger(Guid.NewGuid(), Flag.Id, TriggerTypes.FfGeneral, TriggerActions.TurnOff, "existing trigger");
            StoredTriggers = new Dictionary<Guid, Trigger> { [Trigger.Id] = Trigger };
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureServices(services =>
            {
                var orgId = TestWorkspace.OrganizationId;
                var targetOrgId = _access == "foreign" ? Guid.NewGuid() : orgId;
                var targets = new Mock<IPermissionTargetResolver>();
                targets.Setup(x => x.ResolveEnvironmentAsync(Flag.EnvId))
                    .ReturnsAsync(new PermissionTarget(EnvironmentRn, targetOrgId));
                targets.Setup(x => x.ResolveFlagAsync(Flag.EnvId, Flag.Key))
                    .ReturnsAsync(new PermissionTarget(FlagRn, targetOrgId));

                var policies = new List<PolicyStatement>();
                if (_access != "no-env")
                {
                    policies.Add(Statement(ResourceTypes.Env, EnvironmentRn, Permissions.CanAccessEnv, EffectType.Allow));
                }

                if (_access != "read-only")
                {
                    policies.Add(Statement(ResourceTypes.FeatureFlag, FlagRn, Permissions.ToggleFlag, EffectType.Allow));
                }

                if (_access == "denied-toggle")
                {
                    policies.Add(Statement(ResourceTypes.FeatureFlag, FlagRn, Permissions.ToggleFlag, EffectType.Deny));
                }

                var members = new Mock<IMemberService>();
                members.Setup(x => x.GetPermissionsAsync(orgId, TestUser.Id)).ReturnsAsync(policies.ToArray());

                var flags = new Mock<IFeatureFlagService>();
                flags.Setup(x => x.GetAsync(It.IsAny<Guid>()))
                    .Returns((Guid id) => id == Flag.Id
                        ? Task.FromResult(Flag)
                        : Task.FromException<FeatureFlag>(new EntityNotFoundException(nameof(FeatureFlag), id.ToString())));
                Triggers.Setup(x => x.GetAsync(It.IsAny<Guid>()))
                    .Returns((Guid id) => StoredTriggers.TryGetValue(id, out var trigger)
                        ? Task.FromResult(trigger)
                        : Task.FromException<Trigger>(new EntityNotFoundException(nameof(Trigger), id.ToString())));
                Triggers.Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<Trigger, bool>>>()))
                    .ReturnsAsync((Expression<Func<Trigger, bool>> predicate) =>
                        StoredTriggers.Values.Where(predicate.Compile()).ToArray());
                Triggers.Setup(x => x.AddOneAsync(It.IsAny<Trigger>()))
                    .Callback((Trigger trigger) => StoredTriggers.Add(trigger.Id, trigger)).Returns(Task.CompletedTask);
                Triggers.Setup(x => x.UpdateAsync(It.IsAny<Trigger>()))
                    .Callback((Trigger trigger) => StoredTriggers[trigger.Id] = trigger).Returns(Task.CompletedTask);
                Triggers.Setup(x => x.DeleteOneAsync(It.IsAny<Guid>()))
                    .Callback((Guid id) => StoredTriggers.Remove(id)).Returns(Task.CompletedTask);

                services.Replace(ServiceDescriptor.Singleton(flags.Object));
                services.Replace(ServiceDescriptor.Singleton(Triggers.Object));
                services.Replace(ServiceDescriptor.Singleton(targets.Object));
                services.Replace(ServiceDescriptor.Singleton(members.Object));
                services.Replace(ServiceDescriptor.Scoped<ISender>(sp => sp.GetRequiredService<IMediator>()));
            });
        }

        private static PolicyStatement Statement(string type, string rn, string action, string effect) =>
            new() { ResourceType = type, Resources = [rn], Actions = [action], Effect = effect };
    }
}
