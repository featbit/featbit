using Domain.Environments;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Webhooks;

namespace Domain.UnitTests.Webhooks;

public class DataObjectBuilderTests
{
    private static ResourceDescriptor NewDescriptor() => new()
    {
        Organization = new IdNameKeyProps { Id = Guid.NewGuid(), Name = "Org", Key = "org" },
        Project = new IdNameKeyProps { Id = Guid.NewGuid(), Name = "Proj", Key = "proj" },
        Environment = new IdNameKeyProps { Id = Guid.NewGuid(), Name = "Env", Key = "env" }
    };

    [Fact]
    public void New_PopulatesEventsOperatorAndHappenedAt()
    {
        var now = DateTime.UtcNow;

        var data = DataObjectBuilder.New(["flag.update", "flag.archive"], "and", now);

        Assert.Equal("flag.update,flag.archive", data["events"]);
        Assert.Equal("and", data["operator"]);
        Assert.Equal(now, data["happenedAt"]);
    }

    [Fact]
    public void AddResourceDescriptor_AddsOrgProjectEnvSubObjects()
    {
        var data = DataObjectBuilder.New([], "and", DateTime.UtcNow);
        var descriptor = NewDescriptor();

        data.AddResourceDescriptor(descriptor);

        var org = (Dictionary<string, object>)data["organization"];
        var proj = (Dictionary<string, object>)data["project"];
        var env = (Dictionary<string, object>)data["environment"];
        Assert.Equal(descriptor.Organization.Id, org["id"]);
        Assert.Equal(descriptor.Project.Name, proj["name"]);
        Assert.Equal(descriptor.Environment.Id, env["id"]);
    }

    [Fact]
    public void AddFeatureFlag_RendersFlagShapeWithBooleansAsStrings()
    {
        var flag = new FeatureFlag(
            envId: Guid.NewGuid(),
            name: "my-flag",
            description: "desc",
            key: "my-flag",
            isEnabled: true,
            variationType: "boolean",
            variations: [new Variation { Id = "v1", Name = "true", Value = "true" }],
            disabledVariationId: "v1",
            enabledVariationId: "v1",
            tags: [],
            currentUserId: Guid.NewGuid());

        var data = DataObjectBuilder.New([], "and", DateTime.UtcNow);
        data.AddFeatureFlag(flag);

        var payload = (Dictionary<string, object>)data["data"];
        var obj = (Dictionary<string, object>)payload["object"];

        Assert.Equal("feature flag", payload["kind"]);
        Assert.Equal("my-flag", obj["name"]);
        Assert.Equal("true", obj["isEnabled"]);
        Assert.Equal("false", obj["isArchived"]);
    }

    [Fact]
    public void AddSegment_RendersSegmentShape()
    {
        var segment = new Segment(
            workspaceId: Guid.NewGuid(),
            envId: Guid.NewGuid(),
            name: "ops-team",
            key: "ops-team",
            type: SegmentType.EnvironmentSpecific,
            scopes: [],
            included: ["alice"],
            excluded: ["bob"],
            rules: [],
            description: "team segment");

        var data = DataObjectBuilder.New([], "and", DateTime.UtcNow);
        data.AddSegment(segment, []);

        var payload = (Dictionary<string, object>)data["data"];
        var obj = (Dictionary<string, object>)payload["object"];

        Assert.Equal("segment", payload["kind"]);
        Assert.Equal("ops-team", obj["name"]);
        Assert.Equal(new[] { "alice" }, obj["included"]);
        Assert.Equal(new[] { "bob" }, obj["excluded"]);
    }

    [Fact]
    public void AddChanges_StoresArrayUnderChangesKey()
    {
        var data = DataObjectBuilder.New([], "and", DateTime.UtcNow);

        data.AddChanges(["name", "description"]);

        Assert.Equal(new[] { "name", "description" }, data["changes"]);
    }
}
