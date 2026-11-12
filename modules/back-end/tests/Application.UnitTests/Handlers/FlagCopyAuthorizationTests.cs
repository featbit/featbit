using System.Linq.Expressions;
using Application.Bases.Exceptions;
using Application.FeatureFlags;
using Application.Policies;
using Application.Services;
using Application.Users;
using Domain.EndUsers;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;
using MediatR;

namespace Application.UnitTests.Handlers;

public class FlagCopyAuthorizationTests
{
    private readonly Guid _org = Guid.NewGuid(), _source = Guid.NewGuid(), _target = Guid.NewGuid();
    private readonly Mock<IResourceService> _resources = new();
    private readonly Mock<IFeatureFlagService> _flags = new();
    private readonly List<FeatureFlag> _stored = [];
    private readonly FlagAccessGuard _guard;
    private static PolicyStatement Statement(string action, string rn, string effect = EffectType.Allow) => new()
    {
        ResourceType = action == Permissions.CanAccessEnv ? ResourceTypes.Env : ResourceTypes.FeatureFlag,
        Actions = [action], Resources = [rn], Effect = effect
    };
    private static PolicyStatement[] All => [new() { ResourceType = ResourceTypes.All, Effect = EffectType.Allow, Actions = ["*"], Resources = ["*"] }];
    private static PolicyStatement EnvAccess => Statement(Permissions.CanAccessEnv, "project/p:env/*");

    public FlagCopyAuthorizationTests()
    {
        _resources.Setup(x => x.GetEnvRnAsync(_source)).ReturnsAsync(new ResourceRn("project/p:env/source", _org));
        _resources.Setup(x => x.GetEnvRnAsync(_target)).ReturnsAsync(new ResourceRn("project/p:env/target", _org));
        _flags.Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
            .ReturnsAsync((Expression<Func<FeatureFlag, bool>> predicate) => _stored.Where(predicate.Compile()).ToArray());
        _guard = new FlagAccessGuard(_resources.Object, _flags.Object);
    }

    private FeatureFlag Add(Guid env, string key = "flag", params string[] tags)
    {
        var flag = new FeatureFlag(env, key, "", key, false, VariationTypes.Boolean,
            [new() { Id = "off", Value = "false" }, new() { Id = "on", Value = "true" }],
            "off", "on", tags, Guid.NewGuid()) { Id = Guid.NewGuid() };
        _stored.Add(flag);
        return flag;
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("foreign")]
    [InlineData("null-org")]
    [InlineData("blank-rn")]
    public async Task InvalidEnvironmentOwnership_IsDeniedEvenWithAllPolicy(string invalid)
    {
        ResourceRn resource = invalid switch
        {
            "missing" => null!, "foreign" => new("project/p:env/source", Guid.NewGuid()),
            "null-org" => new("project/p:env/source", null), _ => new(" ", _org)
        };
        _resources.Setup(x => x.GetEnvRnAsync(_source)).ReturnsAsync(resource);
        await Assert.ThrowsAsync<ForbiddenException>(() => _guard.EnsureEnvironmentAccessAsync(_org, _source, All));
    }

    [Fact]
    public async Task EmptyOrganization_IsDeniedWithoutQuerying()
    {
        await Assert.ThrowsAsync<ForbiddenException>(() => _guard.EnsureEnvironmentAccessAsync(Guid.Empty, _source, All));
        _resources.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("source")]
    [InlineData("target")]
    public async Task BothEnvironmentAccessPermissionsAreRequired(string denied)
    {
        var flag = Add(_source);
        var policies = All.Append(Statement(Permissions.CanAccessEnv, $"project/p:env/{denied}", EffectType.Deny)).ToArray();
        await Assert.ThrowsAsync<ForbiddenException>(() => _guard.GetAuthorizedFlagsForCopyAsync(_org, _source, _target, [flag.Id], policies));
        _flags.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("source", true)]
    [InlineData("target", false)]
    public async Task CopyPermissionMustMatchSourceFlag(string environment, bool allowed)
    {
        var flag = Add(_source);
        PolicyStatement[] policies = [EnvAccess, Statement(Permissions.CopyFlagTo, $"project/p:env/{environment}:flag/flag")];
        if (allowed)
            Assert.Same(flag, Assert.Single(await _guard.GetAuthorizedFlagsForCopyAsync(_org, _source, _target, [flag.Id], policies)));
        else
            await Assert.ThrowsAsync<ForbiddenException>(() => _guard.GetAuthorizedFlagsForCopyAsync(_org, _source, _target, [flag.Id], policies));
    }

    [Theory]
    [InlineData(true, "missing")]
    [InlineData(false, "missing")]
    [InlineData(true, "other-env")]
    [InlineData(false, "other-env")]
    [InlineData(true, "key-deny")]
    [InlineData(false, "key-deny")]
    [InlineData(true, "key-missing")]
    [InlineData(false, "key-missing")]
    [InlineData(true, "tag-deny")]
    [InlineData(false, "tag-deny")]
    [InlineData(true, "tag-missing")]
    [InlineData(false, "tag-missing")]
    [InlineData(true, "tag-comma")]
    [InlineData(false, "tag-comma")]
    [InlineData(true, "tag-semicolon")]
    [InlineData(false, "tag-semicolon")]
    [InlineData(true, "tag-colon")]
    [InlineData(false, "tag-colon")]
    [InlineData(true, "tag-percent")]
    [InlineData(false, "tag-percent")]
    public async Task InvalidBatch_IsRejectedBeforePrecheckOrAnyWrite(bool preview, string invalid)
    {
        var first = Add(_source, "allowed", "copyable");
        var second = Add(invalid == "other-env" ? _target : _source, "denied", invalid switch
        {
            "tag-comma" => "internal,copyable",
            "tag-semicolon" => "copyable;internal",
            "tag-colon" => "copyable:env/other",
            "tag-percent" => "internal%2Ccopyable",
            _ => "restricted"
        });
        var policies = new List<PolicyStatement> { EnvAccess };
        policies.Add(Statement(Permissions.CopyFlagTo, invalid switch
        {
            "key-missing" => "project/p:env/source:flag/allowed",
            "tag-missing" or "tag-comma" or "tag-semicolon" or "tag-colon" or "tag-percent" => "project/p:env/source:flag/*;copyable",
            _ => "project/p:env/source:flag/*"
        }));
        if (invalid.EndsWith("deny"))
            policies.Add(Statement(Permissions.CopyFlagTo, invalid == "tag-deny"
                ? "project/p:env/source:flag/*;restricted" : "project/p:env/source:flag/denied", EffectType.Deny));
        var permissions = policies.ToArray();
        Assert.Same(first, Assert.Single(await _guard.GetAuthorizedFlagsForCopyAsync(_org, _source, _target, [first.Id], permissions)));
        _flags.Invocations.Clear();
        var users = new Mock<IEndUserService>(MockBehavior.Strict);
        var resources = new Mock<IResourceServiceV2>(MockBehavior.Strict);
        var envs = new Mock<IEnvironmentService>(MockBehavior.Strict);
        var publisher = new Mock<IPublisher>(MockBehavior.Strict);
        var precheck = new FlagCopyPrecheck(_flags.Object, users.Object, resources.Object);
        Guid[] ids = [first.Id, invalid == "missing" ? Guid.NewGuid() : second.Id];
        if (preview)
            await Assert.ThrowsAsync<ForbiddenException>(() => new CopyToEnvPrecheckHandler(_guard, precheck).Handle(new()
            { OrgId = _org, SourceEnvId = _source, TargetEnvId = _target, FlagIds = ids, Permissions = permissions }, default));
        else
            await Assert.ThrowsAsync<ForbiddenException>(() => new CopyToEnvHandler(_flags.Object, users.Object, envs.Object,
                Mock.Of<ICurrentUser>(), publisher.Object, _guard, precheck).Handle(new()
            {
                OrgId = _org, SourceEnvId = _source, TargetEnvId = _target, FlagIds = ids, Permissions = permissions,
                PrecheckResults = ids.Select(id => new CopyToEnvPrecheckResult { Id = id, KeyCheck = true, TargetRuleCheck = true }).ToArray()
            }, default));
        _flags.Verify(x => x.FindManyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()), Times.Once);
        _flags.VerifyNoOtherCalls();
        users.VerifyNoOtherCalls(); resources.VerifyNoOtherCalls(); envs.VerifyNoOtherCalls(); publisher.VerifyNoOtherCalls();
        Assert.Equal(_source, first.EnvId);
    }

    [Theory]
    [InlineData("copyable", true)]
    [InlineData("unrelated", false)]
    [InlineData("", false)]
    public async Task TagPermissionRequiresMatchingSourceTag(string tag, bool allowed)
    {
        var flag = Add(_source, "flag", tag.Length == 0 ? [] : ["team", tag]);
        PolicyStatement[] policies = [EnvAccess, Statement(Permissions.CopyFlagTo, "project/p:env/source:flag/*;copyable")];
        if (allowed)
            Assert.Same(flag, Assert.Single(await _guard.GetAuthorizedFlagsForCopyAsync(_org, _source, _target, [flag.Id], policies)));
        else
            await Assert.ThrowsAsync<ForbiddenException>(() => _guard.GetAuthorizedFlagsForCopyAsync(_org, _source, _target, [flag.Id], policies));
    }

    [Fact]
    public async Task TargetFlagDenyDoesNotDenySourceCopyPermission()
    {
        var flag = Add(_source);
        var policies = All.Append(Statement(Permissions.CopyFlagTo, "project/p:env/target:flag/flag", EffectType.Deny)).ToArray();
        Assert.Same(flag, Assert.Single(await _guard.GetAuthorizedFlagsForCopyAsync(_org, _source, _target, [flag.Id], policies)));
    }

    [Fact]
    public async Task DuplicateIdsAreDeduplicatedAndEnvironmentRnsAreReusedOnlyWithinBatch()
    {
        var a = Add(_source, "a"); var b = Add(_source, "b");
        for (var call = 1; call <= 2; call++)
        {
            Assert.Equal(2, (await _guard.GetAuthorizedFlagsForCopyAsync(_org, _source, _target, [a.Id, a.Id, b.Id], All)).Count);
            _resources.Verify(x => x.GetEnvRnAsync(_source), Times.Exactly(call));
            _resources.Verify(x => x.GetEnvRnAsync(_target), Times.Exactly(call));
        }
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Copy_RechecksDuplicateKeysAndIgnoresForgedNewProperties(bool duplicate)
    {
        var flag = Add(_source);
        if (duplicate) Add(_target);
        var users = new Mock<IEndUserService>();
        users.Setup(x => x.GetPropertiesAsync(_target)).ReturnsAsync(Array.Empty<EndUserProperty>());
        var resources = new Mock<IResourceServiceV2>();
        resources.Setup(x => x.GetRNAsync(_target, ResourceTypes.Env)).ReturnsAsync("organization/o:project/p:env/target");
        _flags.Setup(x => x.GetRelatedSegmentsAsync(It.IsAny<ICollection<FeatureFlag>>())).ReturnsAsync(Array.Empty<Segment>());
        var handler = new CopyToEnvHandler(_flags.Object, users.Object, Mock.Of<IEnvironmentService>(), Mock.Of<ICurrentUser>(),
            Mock.Of<IPublisher>(), _guard, new FlagCopyPrecheck(_flags.Object, users.Object, resources.Object));
        var result = await handler.Handle(new()
        {
            OrgId = _org, SourceEnvId = _source, TargetEnvId = _target, FlagIds = [flag.Id], Permissions = All,
            PrecheckResults = [new() { Id = flag.Id, KeyCheck = true, TargetRuleCheck = true, NewProperties = ["forged"] }]
        }, default);
        Assert.Equal(duplicate ? 0 : 1, result.CopiedCount);
        _flags.Verify(x => x.AddOneAsync(It.IsAny<FeatureFlag>()), duplicate ? Times.Never() : Times.Once());
        users.Verify(x => x.AddNewPropertiesAsync(It.IsAny<Guid>(), It.IsAny<ICollection<string>>()), Times.Never);
    }

    [Fact]
    public async Task CopySettings_ImplicitVariationChangesRequirePermissionBeforeWriting()
    {
        var source = Add(_source); var target = Add(_target);
        target.Variations = target.Variations.Take(1).ToArray();
        _flags.Setup(x => x.GetAsync(_source, "flag")).ReturnsAsync(source);
        _flags.Setup(x => x.GetAsync(_target, "flag")).ReturnsAsync(target);
        _flags.Setup(x => x.GetRelatedSegmentsAsync(It.IsAny<ICollection<FeatureFlag>>())).ReturnsAsync(Array.Empty<Segment>());
        _resources.Setup(x => x.GetFlagRnAsync(_target, "flag")).ReturnsAsync(new ResourceRn("project/p:env/target:flag/flag", _org));
        var users = new Mock<IEndUserService>(MockBehavior.Strict);
        var publisher = new Mock<IPublisher>(MockBehavior.Strict);
        var handler = new CopyFlagSettingsHandler(_flags.Object, users.Object, Mock.Of<IEnvironmentService>(), Mock.Of<ICurrentUser>(),
            publisher.Object, _guard, new PermissionGuard(_resources.Object));
        await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(new()
        {
            OrgId = _org, SourceEnvId = _source, TargetEnvId = _target, Key = "flag", Permissions = [EnvAccess],
            Options = new(false, new(false, CopyModes.Overwrite), new(false, CopyModes.Overwrite), false, false)
        }, default));
        _flags.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
        users.VerifyNoOtherCalls(); publisher.VerifyNoOtherCalls();
    }
}
