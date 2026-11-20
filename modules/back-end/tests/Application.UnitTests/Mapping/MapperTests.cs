using Application.AccessTokens;
using Application.Bases.Models;
using Application.Environments;
using Application.FeatureFlags;
using Application.GlobalUsers;
using Application.Groups;
using Application.Members;
using Application.Organizations;
using Application.Policies;
using Application.RelayProxies;
using Application.Segments;
using Application.Users;
using Application.Webhooks;
using Domain.AccessTokens;
using Domain.EndUsers;
using Domain.FeatureFlags;
using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.RelayProxies;
using Domain.Segments;
using Domain.Users;
using Domain.Webhooks;
using Environment = Domain.Environments.Environment;

namespace Application.UnitTests.Mapping;

/// <summary>
/// Pins the mapping behaviour the API relies on: masking, defaults for missing values, null
/// collections becoming empty ones, and the members the handlers fill in themselves.
/// </summary>
public class MapperTests
{
    [Fact]
    public void AccessToken_masks_only_the_token()
    {
        var token = SampleData.Populated<AccessToken>();

        var vm = AccessTokenMapper.ToVm(token);

        Assert.Equal($"{token.Token[..10]}**************", vm.Token);
        Assert.Equal(token.Name, vm.Name);
        Assert.Equal(token.Type, vm.Type);
        Assert.Equal(token.Status, vm.Status);
        Assert.Equal(token.Permissions, vm.Permissions);
        Assert.Null(vm.Creator);
    }

    [Fact]
    public void RelayProxy_masks_only_the_key_and_lists_auto_agents_newest_first()
    {
        var relayProxy = SampleData.Populated<RelayProxy>();

        var vm = RelayProxyMapper.ToVm(relayProxy);

        Assert.Equal($"{relayProxy.Key[..15]}**************", vm.Key);
        Assert.Equal(relayProxy.Name, vm.Name);
        Assert.Equal(relayProxy.Description, vm.Description);
        Assert.Equal(relayProxy.AutoAgents.OrderByDescending(x => x.RegisteredAt), vm.AutoAgents);
        Assert.Null(vm.Serves);
    }

    [Fact]
    public void Organization_without_permissions_or_settings_maps_to_the_defaults()
    {
        var organization = SampleData.WithNulls<Organization>();

        var vm = OrganizationMapper.ToVm(organization);

        Assert.NotNull(vm.DefaultPermissions);
        Assert.NotNull(vm.Settings);
        Assert.Equal(organization.Id.ToString(), vm.Id);
    }

    [Fact]
    public void FeatureFlag_maps_its_serves()
    {
        var flag = SampleData.Populated<FeatureFlag>();
        flag.DisabledVariationId = flag.Variations.First().Id;

        var vm = FeatureFlagMapper.ToVm(flag);

        Assert.Equivalent(flag.Serves(), vm.Serves);
        Assert.Equal(flag.Tags, vm.Tags);
        Assert.Null(vm.Creator);
        Assert.Null(vm.LastChange);
    }

    [Fact]
    public void FeatureFlag_without_targeting_maps_without_serves()
    {
        var flag = SampleData.WithNulls<FeatureFlag>();

        var vm = FeatureFlagMapper.ToVm(flag);

        Assert.Null(vm.Serves);
        Assert.Equal(flag.Key, vm.Key);
    }

    [Fact]
    public void EndUser_without_a_workspace_maps_to_an_empty_workspace_id()
    {
        var endUser = SampleData.WithNulls<EndUser>();
        endUser.WorkspaceId = null;

        var globalUser = GlobalUserMapper.ToGlobalUser(endUser);

        Assert.Equal(Guid.Empty, globalUser.WorkspaceId);
    }

    [Fact]
    public void Member_maps_its_groups_and_a_missing_invitor()
    {
        var member = SampleData.Populated<Member>();
        member.InvitorId = null;

        var vm = MemberMapper.ToVm(member);

        Assert.Null(vm.InvitorId);
        Assert.Equal(member.Groups.Select(x => x.Id.ToString()), vm.Groups.Select(x => x.Id));
    }

    [Fact]
    public void Null_collections_map_to_empty_collections()
    {
        Assert.Empty(AccessTokenMapper.ToVm(SampleData.WithNulls<AccessToken>()).Permissions);
        Assert.Empty(EnvironmentMapper.ToVm(SampleData.WithNulls<Environment>()).Secrets);
        Assert.Empty(FeatureFlagMapper.ToVm(SampleData.WithNulls<FeatureFlag>()).Variations);
        Assert.Empty(GlobalUserMapper.ToGlobalUser(SampleData.WithNulls<EndUser>()).CustomizedProperties);
        Assert.Empty(MemberMapper.ToVm(SampleData.WithNulls<Member>()).Groups);
        Assert.Empty(PolicyMapper.ToVm(SampleData.WithNulls<Policy>()).Statements);
        Assert.Empty(RelayProxyMapper.ToVm(SampleData.WithNulls<RelayProxy>()).AutoAgents);
        Assert.Empty(SegmentMapper.ToVm(SampleData.WithNulls<Segment>()).Scopes);
        Assert.Empty(WebhookMapper.ToVm(SampleData.WithNulls<Webhook>()).Headers);
    }

    [Fact]
    public void Mapped_collections_are_new_instances()
    {
        var segment = SampleData.Populated<Segment>();

        var vm = SegmentMapper.ToVm(segment);

        Assert.Equal(segment.Tags, vm.Tags);
        Assert.NotSame(segment.Tags, vm.Tags);
    }

    [Fact]
    public void Page_keeps_its_total_and_maps_each_item()
    {
        var groups = new PagedResult<Group>(42, [SampleData.Populated<Group>(), SampleData.Populated<Group>()]);

        var page = GroupMapper.ToVm(groups);

        Assert.Equal(42, page.TotalCount);
        Assert.Equal(groups.Items.Select(x => x.Id.ToString()), page.Items.Select(x => x.Id));
    }

    [Fact]
    public void Null_source_maps_to_null()
    {
        Assert.Null(UserMapper.ToVm(null));
        Assert.Null(AccessTokenMapper.ToVm((AccessToken)null));
        Assert.Null(GroupMapper.ToVm((PagedResult<Group>)null));
    }

    [Fact]
    public void Missing_creator_maps_to_null()
    {
        User creator = new List<User>().FirstOrDefault();

        Assert.Null(UserMapper.ToVm(creator));
    }
}
