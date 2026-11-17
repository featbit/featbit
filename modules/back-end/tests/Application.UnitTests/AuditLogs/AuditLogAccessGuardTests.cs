using Application.AuditLogs;
using Application.Bases.Exceptions;
using Application.Services;
using Domain.AuditLogs;
using Domain.Environments;
using Domain.Policies;
using Domain.Resources;

namespace Application.UnitTests.AuditLogs;

public class AuditLogAccessGuardTests
{
    [Theory]
    [InlineData(AuditLogScopes.Environment)]
    [InlineData(AuditLogScopes.Organization)]
    public async Task EnsureQueryAllowedAsync_AllowsAuthorizedQuery(string scope)
    {
        var request = NewRequest(scope);
        var accessGuard = new AuditLogAccessGuard(Environments(request).Object);

        await accessGuard.EnsureQueryAllowedAsync(request);
    }

    [Theory]
    [InlineData("workspace")]
    [InlineData("missing-permission")]
    [InlineData("explicit-deny")]
    [InlineData("different-organization")]
    [InlineData("environment-in-another-organization")]
    [InlineData("missing-environment-permission")]
    [InlineData("mixed-types")]
    [InlineData("organization-resource-in-environment")]
    public async Task EnsureQueryAllowedAsync_RejectsUnauthorizedQuery(string scenario)
    {
        var request = NewRequest(AuditLogScopes.Organization);
        switch (scenario)
        {
            case "workspace":
                request.Filter.Scope = AuditLogScopes.Workspace;
                break;
            case "missing-permission":
                request.Permissions = [];
                break;
            case "explicit-deny":
                request.Permissions = [.. request.Permissions, new PolicyStatement
                {
                    ResourceType = ResourceTypes.Iam, Effect = EffectType.Deny,
                    Actions = [Permissions.CanManageIAM], Resources = [RN.ForIam()]
                }];
                break;
            case "different-organization":
                request.Filter.ScopeId = Guid.NewGuid();
                break;
            case "environment-in-another-organization":
                request.Filter.Scope = AuditLogScopes.Environment;
                request.Filter.RefTypes = [AuditLogRefTypes.FeatureFlag];
                request.OrganizationId = Guid.NewGuid();
                break;
            case "missing-environment-permission":
                request.Filter.Scope = AuditLogScopes.Environment;
                request.Filter.RefTypes = [AuditLogRefTypes.FeatureFlag];
                request.Permissions = [];
                break;
            case "mixed-types":
                request.Filter.RefTypes = [AuditLogRefTypes.Member, AuditLogRefTypes.FeatureFlag];
                break;
            case "organization-resource-in-environment":
                request.Filter.Scope = AuditLogScopes.Environment;
                request.Filter.RefTypes = [AuditLogRefTypes.Member];
                break;
        }

        var accessGuard = new AuditLogAccessGuard(Environments(request).Object);

        await Assert.ThrowsAsync<ForbiddenException>(() => accessGuard.EnsureQueryAllowedAsync(request));
    }

    private static QueryAuditLogs NewRequest(string scope)
    {
        var orgId = Guid.NewGuid();
        return new QueryAuditLogs
        {
            WorkspaceId = Guid.NewGuid(),
            OrganizationId = orgId,
            Permissions =
            [
                new PolicyStatement
                {
                    ResourceType = ResourceTypes.Iam, Effect = EffectType.Allow,
                    Actions = [Permissions.CanManageIAM], Resources = [RN.ForIam()]
                },
                new PolicyStatement
                {
                    ResourceType = ResourceTypes.Env, Effect = EffectType.Allow,
                    Actions = [Permissions.CanAccessEnv], Resources = [RN.ForEnv("project", "env")]
                }
            ],
            Filter = new AuditLogQueryFilter
            {
                Scope = scope,
                ScopeId = orgId,
                RefTypes = scope == AuditLogScopes.Environment
                    ? [AuditLogRefTypes.FeatureFlag, AuditLogRefTypes.Segment]
                    : [AuditLogRefTypes.Member, AuditLogRefTypes.Group, AuditLogRefTypes.Policy]
            }
        };
    }

    private static Mock<IEnvironmentService> Environments(QueryAuditLogs request)
    {
        var service = new Mock<IEnvironmentService>();
        service.Setup(x => x.GetResourceDescriptorAsync(request.Filter.ScopeId)).ReturnsAsync(new ResourceDescriptor
        {
            Organization = new IdNameKeyProps { Id = request.Filter.ScopeId },
            Project = new IdNameKeyProps { Key = "project" },
            Environment = new IdNameKeyProps { Key = "env" }
        });
        return service;
    }
}
