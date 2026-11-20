using Application.Bases.Mapping;
using Application.Bases.Models;
using Domain.RelayProxies;
using Riok.Mapperly.Abstractions;

namespace Application.RelayProxies;

[Mapper]
public static partial class RelayProxyMapper
{
    // The served environments are resolved from the scopes by GetRelayProxyListHandler.
    [MapperIgnoreTarget(nameof(RelayProxyVm.Serves))]
    [MapProperty(nameof(RelayProxy.Key), nameof(RelayProxyVm.Key), Use = nameof(MaskKey))]
    [MapProperty(nameof(RelayProxy.AutoAgents), nameof(RelayProxyVm.AutoAgents), Use = nameof(NewestFirst))]
    public static partial RelayProxyVm ToVm(RelayProxy relayProxy);

    public static PagedResult<RelayProxyVm> ToVm(PagedResult<RelayProxy> relayProxies) =>
        MapperConventions.MapPage(relayProxies, ToVm);

    // Only the first 15 characters of a key are ever shown.
    private static string MaskKey(string key) => key == null ? null : key.Substring(0, 15) + "**************";

    private static AutoAgent[] NewestFirst(AutoAgent[] autoAgents) =>
        MapperConventions.CopyArray(autoAgents?.OrderByDescending(x => x.RegisteredAt));

    [UserMapping(Default = true)]
    private static string[] CopyScopes(string[] scopes) => MapperConventions.CopyArray(scopes);

    [UserMapping(Default = true)]
    private static Agent[] CopyAgents(Agent[] agents) => MapperConventions.CopyArray(agents);
}
