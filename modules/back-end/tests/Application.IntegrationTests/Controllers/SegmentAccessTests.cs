using System.Linq.Expressions;
using System.Net;
using System.Net.Http.Json;
using Api.Authorization;
using Application.Services;
using Application.Segments;
using Domain.Organizations;
using Domain.Projects;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;
using MediatR;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;
using Environment = Domain.Environments.Environment;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class SegmentAccessTests
{
    public static IEnumerable<object[]> DeniedReads =>
        from operation in new[] { "single", "batch", "references" }
        from failure in new[] { "missing", "foreign", "out-of-scope", "workspace" }
        select new object[] { operation, failure };

    [Theory]
    [MemberData(nameof(DeniedReads))]
    public async Task RejectsInaccessibleSegmentIncludingMixedBatch(string operation, string failure)
    {
        await using var app = new SegmentAccessTestApp { Failure = failure };
        var client = await app.CreateAuthenticatedClientAsync();
        var path = operation switch
        {
            "single" => $"{app.Segment.Id}",
            "references" => $"{app.Segment.Id}/flag-references",
            _ => $"by-ids?ids={app.AllowedId}&ids={app.Segment.Id}"
        };
        var response = await client.GetAsync(app.Route + "/" + path);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        app.Segments.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("single")]
    [InlineData("batch")]
    public async Task AllowsSharedSegmentThroughAccessEnvironment(string operation)
    {
        await using var app = new SegmentAccessTestApp();
        var client = await app.CreateAuthenticatedClientAsync();
        var path = operation == "single" ? $"{app.Segment.Id}" : $"by-ids?ids={app.Segment.Id}&ids={app.Segment.Id}";
        var response = await client.GetAsync(app.Route + "/" + path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        app.Resources.Verify(x => x.GetSegmentRnAsync(app.EnvId, app.Segment.Id), Times.Once);
        Assert.NotEqual(app.EnvId, app.Segment.EnvId);
    }

    [Theory]
    [InlineData("general", false)]
    [InlineData("general", true)]
    [InlineData("targeting", false)]
    [InlineData("targeting", true)]
    [InlineData("patch", false)]
    [InlineData("patch", true)]
    public async Task FieldChangesUseRouteEnvironmentIncludingNoOps(string operation, bool changed)
    {
        await using var app = new SegmentAccessTestApp();
        var client = await app.CreateAuthenticatedClientAsync();
        HttpResponseMessage response;
        if (operation == "patch")
            response = await client.PatchAsJsonAsync(app.Route + $"/{app.Segment.Id}",
                changed ? new[] { new { op = "replace", path = "/name", value = "changed" } } : []);
        else if (operation == "general")
            response = await client.PutAsJsonAsync(app.Route + $"/{app.Segment.Id}/general",
                new { name = changed ? "changed" : app.Segment.Name, description = "", tags = app.Segment.Tags });
        else
            response = await client.PutAsJsonAsync(app.Route + $"/{app.Segment.Id}/targeting",
                new { included = changed ? new[] { "user" } : [], excluded = Array.Empty<string>(), rules = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        app.Resources.Verify(x => x.GetSegmentRnAsync(app.EnvId, app.Segment.Id), Times.Once);
        app.Resources.Verify(x => x.GetSegmentRnAsync(app.Segment.EnvId, app.Segment.Id), Times.Never);
    }

    [Theory]
    [InlineData("general", "foreign")]
    [InlineData("general", "out-of-scope")]
    [InlineData("targeting", "foreign")]
    [InlineData("targeting", "out-of-scope")]
    [InlineData("patch", "foreign")]
    [InlineData("patch", "out-of-scope")]
    public async Task NoOpWritesCannotBypassAccessContext(string operation, string failure)
    {
        await using var app = new SegmentAccessTestApp { Failure = failure };
        var client = await app.CreateAuthenticatedClientAsync();
        var path = app.Route + $"/{app.Segment.Id}";
        var response = operation == "patch"
            ? await client.PatchAsJsonAsync(path, Array.Empty<object>())
            : await client.PutAsJsonAsync(path + "/" + operation, new
            { name = app.Segment.Name, description = "", tags = app.Segment.Tags, included = Array.Empty<string>(), excluded = Array.Empty<string>(), rules = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        app.Segments.Verify(x => x.UpdateAsync(It.IsAny<Segment>()), Times.Never);
        app.Publisher.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("")]
    [InlineData("?ids=00000000-0000-0000-0000-000000000000")]
    public async Task EmptyBatchIsRejected(string query)
    {
        await using var app = new SegmentAccessTestApp();
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await client.GetAsync(app.Route + "/by-ids" + query);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        app.Segments.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("id")]
    [InlineData("envId")]
    [InlineData("workspaceId")]
    [InlineData("key")]
    [InlineData("type")]
    [InlineData("scopes")]
    public async Task PatchCannotChangeIdentityOrSharingScope(string field)
    {
        await using var app = new SegmentAccessTestApp();
        var client = await app.CreateAuthenticatedClientAsync();
        object value = field switch
        {
            "key" => "new-key", "type" => SegmentType.EnvironmentSpecific,
            "scopes" => new[] { "organization/other" }, _ => Guid.NewGuid().ToString()
        };
        var response = await client.PatchAsJsonAsync(app.Route + $"/{app.Segment.Id}",
            new[] { new { op = "replace", path = "/" + field, value } });
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Segment identity and scopes cannot be changed.", body);
        app.Segments.Verify(x => x.UpdateAsync(It.IsAny<Segment>()), Times.Never);
        app.Publisher.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("single")]
    [InlineData("is-key-used")]
    [InlineData("general")]
    public async Task EnvironmentAccessIsRequired(string operation)
    {
        await using var app = new SegmentAccessTestApp { Failure = "env-access" };
        var client = await app.CreateAuthenticatedClientAsync();
        var response = operation == "general"
            ? await client.PutAsJsonAsync(app.Route + $"/{app.Segment.Id}/general", new { name = "changed" })
            : await client.GetAsync(app.Route + (operation == "single" ? $"/{app.Segment.Id}" : "/is-key-used?key=key&type=shared"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        app.Segments.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("missing-permission")]
    [InlineData("tag-deny")]
    public async Task SharedWritesRequireTargetSegmentPermission(string failure)
    {
        await using var app = new SegmentAccessTestApp { Failure = failure };
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await client.PutAsJsonAsync(app.Route + $"/{app.Segment.Id}/general",
            new { name = "changed", description = "", tags = app.Segment.Tags });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        app.Segments.Verify(x => x.UpdateAsync(It.IsAny<Segment>()), Times.Never);
        app.Publisher.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ReferencesOnlyIncludeEnvironmentsAuthorizedInTheirOwnOrganization(bool foreignAccess)
    {
        await using var app = new SegmentAccessTestApp { ForeignAccess = foreignAccess };
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await client.GetAsync(app.Route + $"/{app.Segment.Id}/flag-references");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        app.Segments.Verify(x => x.GetFlagReferencesAsync(app.EnvId, app.Segment.Id), Times.Once);
        app.Segments.Verify(x => x.GetFlagReferencesAsync(app.OtherEnvId, app.Segment.Id), foreignAccess ? Times.Once : Times.Never);
    }

    [Theory]
    [InlineData(false, false, true)]
    [InlineData(true, true, true)]
    [InlineData(true, false, false)]
    public async Task CreationChecksEveryScopeBeforeWriting(bool crossOrganization, bool foreignAccess, bool allowed)
    {
        await using var app = new SegmentAccessTestApp { ForeignAccess = foreignAccess };
        var client = await app.CreateAuthenticatedClientAsync();
        var scopes = crossOrganization
            ? new[] { "organization/org:project/p:env/e", "organization/other:project/p:env/e" }
            : new[] { "organization/org:project/p:env/e" };
        var response = await client.PostAsJsonAsync(app.Route, new
        {
            name = "New segment", key = "new", type = crossOrganization ? SegmentType.Shared : SegmentType.EnvironmentSpecific,
            scopes, workspaceId = Guid.NewGuid(), orgId = Guid.NewGuid(), envId = Guid.NewGuid()
        });
        Assert.Equal(allowed ? HttpStatusCode.OK : HttpStatusCode.Forbidden, response.StatusCode);
        app.Segments.Verify(x => x.AddOneAsync(It.IsAny<Segment>()), allowed ? Times.Once : Times.Never);
        if (!allowed) app.Publisher.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("organization/missing:project/p:env/e", 403)]
    [InlineData("organization/org:project/missing:env/e", 403)]
    [InlineData("organization/org:project/p:env/missing", 403)]
    [InlineData("project/p:env/e", 400)]
    [InlineData("organization/org:project/*", 400)]
    public async Task InvalidCreationScopeDoesNotWrite(string scope, int expected)
    {
        await using var app = new SegmentAccessTestApp();
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await client.PostAsJsonAsync(app.Route,
            new { name = "New", key = "new", type = SegmentType.Shared, scopes = new[] { scope } });
        Assert.Equal((HttpStatusCode)expected, response.StatusCode);
        app.Segments.Verify(x => x.AddOneAsync(It.IsAny<Segment>()), Times.Never);
        app.Publisher.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ArchiveChecksReferencesEvenInHiddenEnvironments()
    {
        await using var app = new SegmentAccessTestApp { Referenced = true };
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await client.PutAsJsonAsync(app.Route + $"/{app.Segment.Id}/archive", new { });
        Assert.Contains("SegmentIsBeingUsed", await response.Content.ReadAsStringAsync());
        app.Segments.Verify(x => x.GetFlagReferencesAsync(app.OtherEnvId, app.Segment.Id), Times.Once);
        app.Segments.Verify(x => x.UpdateAsync(It.IsAny<Segment>()), Times.Never);
    }
}

public class SegmentAccessTestApp : PermissionCheckTestApp
{
    public Guid EnvId { get; } = Guid.NewGuid();
    public Guid OtherEnvId { get; } = Guid.NewGuid();
    public Guid OtherOrgId { get; } = Guid.NewGuid();
    public Guid AllowedId { get; } = Guid.NewGuid();
    public string Route => $"/api/v1/envs/{EnvId}/segments";
    public string Failure { get; init; } = "";
    public bool ForeignAccess { get; init; }
    public bool Referenced { get; init; }
    public Segment Segment { get; }
    public Mock<ISegmentService> Segments { get; } = new();
    public Mock<IResourceService> Resources { get; } = new();
    public Mock<IPublisher> Publisher { get; } = new();
    public SegmentAccessTestApp() => Segment = new(TestWorkspace.Id, Guid.NewGuid(), "Segment", "segment",
        SegmentType.Shared, ["organization/org"], [], [], [], "") { Id = Guid.NewGuid(), Tags = ["team"] };

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureServices(services =>
        {
            Resources.Setup(x => x.GetEnvRnAsync(EnvId)).ReturnsAsync(new ResourceRn("project/p:env/e", TestWorkspace.OrganizationId));
            Resources.Setup(x => x.GetEnvRnAsync(OtherEnvId)).ReturnsAsync(new ResourceRn("project/p:env/e", OtherOrgId));
            ResourceRn? rn = Failure switch
            {
                "missing" or "out-of-scope" or "workspace" => null,
                "foreign" => new("project/p:env/e:segment/segment;team", OtherOrgId),
                _ => new("project/p:env/e:segment/segment;team", TestWorkspace.OrganizationId)
            };
            Resources.Setup(x => x.GetSegmentRnAsync(EnvId, Segment.Id)).ReturnsAsync(rn);
            Resources.Setup(x => x.GetSegmentRnAsync(EnvId, AllowedId)).ReturnsAsync(new ResourceRn("project/p:env/e:segment/allowed", TestWorkspace.OrganizationId));
            Segments.Setup(x => x.GetAsync(Segment.Id)).ReturnsAsync(Segment);
            Segments.Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<Segment, bool>>>())).ReturnsAsync(new[] { Segment });
            Segments.Setup(x => x.GetEnvironmentIdsAsync(Segment)).ReturnsAsync(new[] { EnvId, OtherEnvId });
            Segments.Setup(x => x.GetFlagReferencesAsync(EnvId, Segment.Id)).ReturnsAsync(Array.Empty<FlagReference>());
            Segments.Setup(x => x.GetFlagReferencesAsync(OtherEnvId, Segment.Id)).ReturnsAsync(Referenced
                ? new[] { new FlagReference { EnvId = OtherEnvId, Key = "flag", Name = "Flag", Id = Guid.NewGuid() } } : []);
            var policies = new List<PolicyStatement>();
            if (Failure != "env-access") policies.Add(new() { ResourceType = ResourceTypes.Env,
                Effect = EffectType.Allow, Resources = ["project/p:env/e"], Actions = [Permissions.CanAccessEnv] });
            if (Failure != "missing-permission") policies.Add(new() { ResourceType = ResourceTypes.Segment,
                Effect = EffectType.Allow, Resources = ["project/p:env/e:segment/*;team"], Actions = ["*"] });
            if (Failure == "tag-deny") policies.Add(new() { ResourceType = ResourceTypes.Segment,
                Effect = EffectType.Deny, Resources = ["project/p:env/e:segment/*;team"], Actions = [Permissions.UpdateSegmentName] });
            policies.Add(new() { ResourceType = ResourceTypes.Segment, Effect = EffectType.Allow,
                Resources = ["project/p:env/e:segment/*"], Actions = [Permissions.CreateSegment] });
            var members = new Mock<IMemberService>();
            members.Setup(x => x.GetPermissionsAsync(TestWorkspace.OrganizationId, TestUser.Id)).ReturnsAsync(policies.ToArray());
            var orgPermissions = new Mock<IOrganizationPermissions>();
            orgPermissions.Setup(x => x.GetAsync(TestWorkspace.OrganizationId)).ReturnsAsync(policies.ToArray());
            orgPermissions.Setup(x => x.GetAsync(OtherOrgId)).ReturnsAsync(ForeignAccess ? policies.ToArray() : []);
            var orgs = new[]
            {
                new Organization(TestWorkspace.Id, "Org", "org") { Id = TestWorkspace.OrganizationId },
                new Organization(TestWorkspace.Id, "Other", "other") { Id = OtherOrgId }
            };
            var projects = orgs.Select(o => new Project(o.Id, "Project", "p") { Id = Guid.NewGuid() }).ToArray();
            var envs = projects.Select((p, i) => new Environment(p.Id, "Env", "e") { Id = i == 0 ? EnvId : OtherEnvId }).ToArray();
            var organizations = new Mock<IOrganizationService>();
            organizations.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Organization, bool>>>()))
                .ReturnsAsync((Expression<Func<Organization, bool>> p) => orgs.FirstOrDefault(p.Compile()));
            organizations.Setup(x => x.AnyAsync(It.IsAny<Expression<Func<Organization, bool>>>()))
                .ReturnsAsync((Expression<Func<Organization, bool>> p) => orgs.Any(p.Compile()));
            organizations.Setup(x => x.ContainsUserAsync(TestWorkspace.OrganizationId, TestUser.Id)).ReturnsAsync(true);
            var projectService = new Mock<IProjectService>();
            projectService.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Project, bool>>>()))
                .ReturnsAsync((Expression<Func<Project, bool>> p) => projects.FirstOrDefault(p.Compile()));
            var environments = new Mock<IEnvironmentService>();
            environments.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Environment, bool>>>()))
                .ReturnsAsync((Expression<Func<Environment, bool>> p) => envs.FirstOrDefault(p.Compile()));
            var license = new Mock<ILicenseService>();
            license.Setup(x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(true);
            services.Replace(ServiceDescriptor.Singleton(organizations.Object));
            services.Replace(ServiceDescriptor.Singleton(projectService.Object));
            services.Replace(ServiceDescriptor.Singleton(environments.Object));
            services.Replace(ServiceDescriptor.Singleton(license.Object));
            services.Replace(ServiceDescriptor.Singleton(Segments.Object));
            services.Replace(ServiceDescriptor.Singleton(Resources.Object));
            services.Replace(ServiceDescriptor.Singleton(Publisher.Object));
            services.Replace(ServiceDescriptor.Singleton(members.Object));
            services.Replace(ServiceDescriptor.Singleton(orgPermissions.Object));
            services.Replace(ServiceDescriptor.Scoped<IPermissionChecker, DefaultPermissionChecker>());
            services.Replace(ServiceDescriptor.Scoped<ISender>(sp => sp.GetRequiredService<IMediator>()));
        });
    }
}
