using Application.Bases.Mapping;
using Application.Bases.Models;
using Domain.EndUsers;
using Riok.Mapperly.Abstractions;

namespace Application.GlobalUsers;

[Mapper]
public static partial class GlobalUserMapper
{
    public static partial GlobalUser ToGlobalUser(EndUser endUser);

    public static PagedResult<GlobalUser> ToGlobalUser(PagedResult<EndUser> endUsers) =>
        MapperConventions.MapPage(endUsers, ToGlobalUser);

    // An end user without a workspace maps to an empty workspace id.
    [UserMapping(Default = true)]
    private static Guid WorkspaceIdOrEmpty(Guid? workspaceId) => workspaceId ?? Guid.Empty;

    [UserMapping(Default = true)]
    private static ICollection<EndUserCustomizedProperty> CopyProperties(ICollection<EndUserCustomizedProperty> properties) =>
        MapperConventions.CopyList(properties);
}
