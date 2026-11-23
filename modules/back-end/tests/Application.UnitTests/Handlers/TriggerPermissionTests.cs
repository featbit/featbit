using System.Linq.Expressions;
using System.Text.Json;
using Application.Bases.Exceptions;
using Application.Environments;
using Application.Services;
using Application.Triggers;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;
using Domain.Triggers;

namespace Application.UnitTests.Handlers;

public class TriggerPermissionTests
{
    [Theory]
    [InlineData("list", "foreign", false)]
    [InlineData("create", "foreign", false)]
    [InlineData("update", "foreign", false)]
    [InlineData("reset", "foreign", false)]
    [InlineData("delete", "foreign", false)]
    [InlineData("list", "no-env", false)]
    [InlineData("list", "read-only", true)]
    [InlineData("create", "read-only", false)]
    [InlineData("list", "deny-env", false)]
    [InlineData("reset", "deny-toggle", false)]
    [InlineData("create", "allowed", true)]
    [InlineData("reset", "allowed", true)]
    public async Task HandlersEnforceAccessBeforeReadingOrWriting(string operation, string scenario, bool allowed)
    {
        var org = Guid.NewGuid();
        var flag = new FeatureFlag(Guid.NewGuid(), "Flag", "", "flag", false, VariationTypes.Boolean,
            [new() { Id = "off", Value = "false" }, new() { Id = "on", Value = "true" }],
            "off", "on", [], Guid.NewGuid()) { Id = Guid.NewGuid() };
        var trigger = new Trigger(Guid.NewGuid(), flag.Id, TriggerTypes.FfGeneral, TriggerActions.TurnOff, "test");
        var before = JsonSerializer.Serialize(trigger);
        var flags = new Mock<IFeatureFlagService>();
        flags.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
            .ReturnsAsync((Expression<Func<FeatureFlag, bool>> predicate) => predicate.Compile()(flag) ? flag : null!);
        var resources = new Mock<IPermissionTargetResolver>();
        resources.Setup(x => x.ResolveEnvironmentAsync(flag.EnvId)).ReturnsAsync(
            new PermissionTarget("project/p:env/e", scenario == "foreign" ? Guid.NewGuid() : org));
        resources.Setup(x => x.ResolveFlagAsync(flag.EnvId, flag.Key)).ReturnsAsync(
            new PermissionTarget("project/p:env/e:flag/flag", scenario == "foreign" ? Guid.NewGuid() : org));
        var triggers = new Mock<ITriggerService>();
        triggers.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Trigger, bool>>>()))
            .ReturnsAsync((Expression<Func<Trigger, bool>> predicate) => predicate.Compile()(trigger) ? trigger : null!);
        triggers.Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<Trigger, bool>>>())).ReturnsAsync([trigger]);
        var guard = new TriggerAccessGuard(flags.Object, triggers.Object, new EnvironmentPermissionGuard(resources.Object, Mock.Of<IOrganizationPermissions>()), resources.Object);
        var policies = new List<PolicyStatement>();
        if (scenario != "no-env") policies.Add(Statement(ResourceTypes.Env, Permissions.CanAccessEnv));
        if (scenario != "read-only") policies.Add(Statement(ResourceTypes.FeatureFlag, Permissions.ToggleFlag));
        if (scenario == "foreign") policies.Add(Statement(ResourceTypes.All, "*"));
        if (scenario == "deny-env") policies.Add(Statement(ResourceTypes.Env, Permissions.CanAccessEnv, EffectType.Deny));
        if (scenario == "deny-toggle") policies.Add(Statement(ResourceTypes.FeatureFlag, Permissions.ToggleFlag, EffectType.Deny));
        var permissions = policies.ToArray();

        async Task Execute()
        {
            switch (operation)
            {
                case "list":
                    var list = await new GetTriggerListHandler(triggers.Object, guard)
                        .Handle(new GetTriggerList(flag.Id, org, permissions), default);
                    Assert.Contains("***", Assert.Single(list).Token);
                    break;
                case "create":
                    await new CreateTriggerHandler(triggers.Object, guard).Handle(new CreateTrigger(
                        new CreateTriggerPayload { TargetId = flag.Id, Type = TriggerTypes.FfGeneral, Action = TriggerActions.TurnOff }, org, permissions), default);
                    triggers.Verify(x => x.AddOneAsync(It.Is<Trigger>(t => t.TargetId == flag.Id)), Times.Once);
                    break;
                case "update":
                    await new UpdateTriggerHandler(triggers.Object, guard).Handle(new UpdateTrigger(
                        new UpdateTriggerPayload { IsEnabled = false }, trigger.Id, org, permissions), default);
                    Assert.False(trigger.IsEnabled);
                    triggers.Verify(x => x.UpdateAsync(trigger), Times.Once);
                    break;
                case "reset":
                    var token = await new ResetTriggerTokenHandler(triggers.Object, guard)
                        .Handle(new ResetTriggerToken(trigger.Id, org, permissions), default);
                    Assert.Equal(trigger.Token, token);
                    triggers.Verify(x => x.UpdateAsync(trigger), Times.Once);
                    break;
                case "delete":
                    await new DeleteTriggerHandler(triggers.Object, guard)
                        .Handle(new DeleteTrigger(trigger.Id, org, permissions), default);
                    triggers.Verify(x => x.DeleteOneAsync(trigger.Id), Times.Once);
                    break;
                default: throw new InvalidOperationException(operation);
            }
        }

        if (allowed) await Execute();
        else
        {
            await Assert.ThrowsAsync<ForbiddenException>(Execute);
            Assert.Equal(before, JsonSerializer.Serialize(trigger));
            triggers.Verify(x => x.AddOneAsync(It.IsAny<Trigger>()), Times.Never);
            triggers.Verify(x => x.UpdateAsync(It.IsAny<Trigger>()), Times.Never);
            triggers.Verify(x => x.DeleteOneAsync(It.IsAny<Guid>()), Times.Never);
            triggers.Verify(x => x.FindManyAsync(It.IsAny<Expression<Func<Trigger, bool>>>()), Times.Never);
        }
    }

    private static PolicyStatement Statement(string resourceType, string action, string effect = EffectType.Allow) =>
        new() { ResourceType = resourceType, Effect = effect, Actions = [action], Resources = ["*"] };
}
