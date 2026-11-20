using Application.Bases.Mapping;
using Domain.Workspaces;
using Riok.Mapperly.Abstractions;

namespace Application.Workspaces;

[Mapper]
public static partial class WorkspaceMapper
{
    public static partial WorkspaceVm ToVm(Workspace workspace);

    public static List<WorkspaceVm> ToVm(IEnumerable<Workspace> workspaces) => MapperConventions.MapList(workspaces, ToVm);
}
