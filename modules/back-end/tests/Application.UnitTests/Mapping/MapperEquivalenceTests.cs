using System.Text.Json;
using Application.AccessTokens;
using Application.AuditLogs;
using Application.Bases.Models;
using Application.Environments;
using Application.Experiments.ExperimentLayers;
using Application.Experiments.ExperimentMetrics;
using Application.FeatureFlags;
using Application.GlobalUsers;
using Application.Groups;
using Application.Members;
using Application.Organizations;
using Application.Policies;
using Application.Projects;
using Application.RelayProxies;
using Application.Segments;
using Application.Users;
using Application.Webhooks;
using Application.Workspaces;
using AutoMapper;
using Domain.AccessTokens;
using Domain.AuditLogs;
using Domain.EndUsers;
using Domain.Experiments;
using Domain.FeatureFlags;
using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Projects;
using Domain.RelayProxies;
using Domain.Segments;
using Domain.Users;
using Domain.Webhooks;
using Domain.Workspaces;
using Environment = Domain.Environments.Environment;

namespace Application.UnitTests.Mapping;

/// <summary>
/// Runs the same input through the AutoMapper profiles and the Mapperly mappers that replace them and
/// asserts the serialized results are identical: for a fully populated source, for a source whose
/// collections and nested objects are all null, and for a null source.
/// </summary>
public class MapperEquivalenceTests
{
    private static readonly IMapper AutoMapper =
        new MapperConfiguration(config => config.AddMaps(typeof(AccessTokenVm).Assembly)).CreateMapper();

    private static readonly JsonSerializerOptions JsonOptions = new() { IncludeFields = true };

    private static readonly Dictionary<string, Action<bool>> Cases = new()
    {
        ["AccessToken"] = nulls => AssertSame<AccessToken, AccessTokenVm>(nulls, AccessTokenMapper.ToVm),
        ["AccessToken page"] = nulls => AssertSamePage<AccessToken, AccessTokenVm>(nulls, AccessTokenMapper.ToVm),
        ["AuditLog"] = nulls => AssertSame<AuditLog, AuditLogVm>(nulls, AuditLogMapper.ToVm),
        ["AuditLog page"] = nulls => AssertSamePage<AuditLog, AuditLogVm>(nulls, AuditLogMapper.ToVm),
        ["Environment"] = nulls => AssertSame<Environment, EnvironmentVm>(nulls, EnvironmentMapper.ToVm),
        ["ExperimentLayer"] = nulls => AssertSame<ExperimentLayer, ExperimentLayerVm>(nulls, ExperimentLayerMapper.ToVm),
        ["ExperimentLayer page"] = nulls => AssertSamePage<ExperimentLayer, ExperimentLayerVm>(nulls, ExperimentLayerMapper.ToVm),
        ["ExperimentMetric"] = nulls => AssertSame<ExperimentMetric, ExperimentMetricVm>(nulls, ExperimentMetricMapper.ToVm),
        ["ExperimentMetric page"] = nulls => AssertSamePage<ExperimentMetric, ExperimentMetricVm>(nulls, ExperimentMetricMapper.ToVm),
        ["FeatureFlag"] = nulls => AssertSame<FeatureFlag, FeatureFlagVm>(nulls, FeatureFlagMapper.ToVm, MakeServesValid),
        ["FeatureFlag page"] = nulls => AssertSamePage<FeatureFlag, FeatureFlagVm>(nulls, FeatureFlagMapper.ToVm, MakeServesValid),
        ["EndUser to GlobalUser"] = nulls => AssertSame<EndUser, GlobalUser>(nulls, GlobalUserMapper.ToGlobalUser),
        ["EndUser page to GlobalUser page"] = nulls => AssertSamePage<EndUser, GlobalUser>(nulls, GlobalUserMapper.ToGlobalUser),
        ["Group"] = nulls => AssertSame<Group, GroupVm>(nulls, GroupMapper.ToVm),
        ["Group page"] = nulls => AssertSamePage<Group, GroupVm>(nulls, GroupMapper.ToVm),
        ["Member"] = nulls => AssertSame<Member, MemberVm>(nulls, MemberMapper.ToVm),
        ["Member page"] = nulls => AssertSamePage<Member, MemberVm>(nulls, MemberMapper.ToVm),
        ["Member lookup"] = nulls => AssertSame<Member, MemberLookupVm>(nulls, MemberMapper.ToLookupVm),
        ["Member lookup page"] = nulls => AssertSamePage<Member, MemberLookupVm>(nulls, MemberMapper.ToLookupVm),
        ["MemberGroup"] = nulls => AssertSame<MemberGroup, MemberGroupVm>(nulls, MemberMapper.ToVm),
        ["MemberGroup page"] = nulls => AssertSamePage<MemberGroup, MemberGroupVm>(nulls, MemberMapper.ToVm),
        ["Organization"] = nulls => AssertSame<Organization, OrganizationVm>(nulls, OrganizationMapper.ToVm),
        ["Organization list"] = nulls => AssertSameList<Organization, OrganizationVm>(nulls, OrganizationMapper.ToVm),
        ["Policy"] = nulls => AssertSame<Policy, PolicyVm>(nulls, PolicyMapper.ToVm),
        ["Policy page"] = nulls => AssertSamePage<Policy, PolicyVm>(nulls, PolicyMapper.ToVm),
        ["Policy list"] = nulls => AssertSameList<Policy, PolicyVm>(nulls, PolicyMapper.ToVm),
        ["Project"] = nulls => AssertSame<Project, ProjectVm>(nulls, ProjectMapper.ToVm),
        ["RelayProxy"] = nulls => AssertSame<RelayProxy, RelayProxyVm>(nulls, RelayProxyMapper.ToVm),
        ["RelayProxy page"] = nulls => AssertSamePage<RelayProxy, RelayProxyVm>(nulls, RelayProxyMapper.ToVm),
        ["Segment"] = nulls => AssertSame<Segment, SegmentVm>(nulls, SegmentMapper.ToVm),
        ["Segment page"] = nulls => AssertSamePage<Segment, SegmentVm>(nulls, SegmentMapper.ToVm),
        ["User"] = nulls => AssertSame<User, UserVm>(nulls, UserMapper.ToVm),
        ["Webhook"] = nulls => AssertSame<Webhook, WebhookVm>(nulls, WebhookMapper.ToVm),
        ["Webhook page"] = nulls => AssertSamePage<Webhook, WebhookVm>(nulls, WebhookMapper.ToVm),
        ["Workspace"] = nulls => AssertSame<Workspace, WorkspaceVm>(nulls, WorkspaceMapper.ToVm),
        ["Workspace list"] = nulls => AssertSameList<Workspace, WorkspaceVm, ICollection<WorkspaceVm>>(nulls, WorkspaceMapper.ToVm),
    };

    public static TheoryData<string> CaseNames => new(Cases.Keys);

    [Theory]
    [MemberData(nameof(CaseNames))]
    public void Populated_source_maps_the_same(string name) => Cases[name](false);

    [Theory]
    [MemberData(nameof(CaseNames))]
    public void Source_with_null_collections_and_objects_maps_the_same(string name) => Cases[name](true);

    [Fact]
    public void Null_source_maps_to_null()
    {
        Assert.Null(AutoMapper.Map<UserVm>((User)null));
        Assert.Null(UserMapper.ToVm(null));
        Assert.Null(AutoMapper.Map<AccessTokenVm>((AccessToken)null));
        Assert.Null(AccessTokenMapper.ToVm((AccessToken)null));
        Assert.Null(AutoMapper.Map<PagedResult<GroupVm>>((PagedResult<Group>)null));
        Assert.Null(GroupMapper.ToVm((PagedResult<Group>)null));
    }

    private static TSource Make<TSource>(bool nulls, Action<TSource> fixUp)
    {
        var source = nulls ? SampleData.WithNulls<TSource>() : SampleData.Populated<TSource>();
        if (!nulls)
        {
            fixUp?.Invoke(source);
        }

        return source;
    }

    private static void AssertSame<TSource, TTarget>(bool nulls, Func<TSource, TTarget> mapperly, Action<TSource> fixUp = null)
       
    {
        var source = Make(nulls, fixUp);
        AssertSameResult(() => AutoMapper.Map<TTarget>(source), () => mapperly(source));
    }

    private static void AssertSamePage<TSource, TTarget>(
        bool nulls,
        Func<PagedResult<TSource>, PagedResult<TTarget>> mapperly,
        Action<TSource> fixUp = null)
    {
        var page = new PagedResult<TSource>(42, nulls ? null : [Make(false, fixUp), Make(false, fixUp)]);
        AssertSameResult(() => AutoMapper.Map<PagedResult<TTarget>>(page), () => mapperly(page));
    }

    private static void AssertSameList<TSource, TTarget>(bool nulls, Func<IEnumerable<TSource>, List<TTarget>> mapperly)
        =>
        AssertSameList<TSource, TTarget, IEnumerable<TTarget>>(nulls, mapperly);

    private static void AssertSameList<TSource, TTarget, TCollection>(bool nulls, Func<IEnumerable<TSource>, List<TTarget>> mapperly)
       
    {
        IEnumerable<TSource> source = nulls ? [] : [Make<TSource>(false, null), Make<TSource>(false, null)];
        AssertSameResult(() => AutoMapper.Map<TCollection>(source), () => mapperly(source));
    }

    private static void AssertSameResult<TExpected, TActual>(Func<TExpected> autoMapper, Func<TActual> mapperly)
    {
        var expected = Outcome(() => autoMapper());
        var actual = Outcome(() => mapperly());
        Assert.Equal(expected, actual);
    }

    // The serialized result, or the type of the exception thrown (unwrapped from AutoMapper's wrapper).
    private static string Outcome(Func<object> map)
    {
        try
        {
            return JsonSerializer.Serialize(map(), JsonOptions);
        }
        catch (AutoMapperMappingException ex) when (ex.InnerException != null)
        {
            return $"throws {ex.GetBaseException().GetType().Name}";
        }
        catch (Exception ex)
        {
            return $"throws {ex.GetType().Name}";
        }
    }

    // Serves() looks up the disabled variation by id, so point it at one of the flag's variations.
    private static void MakeServesValid(FeatureFlag flag) => flag.DisabledVariationId = flag.Variations.First().Id;
}
