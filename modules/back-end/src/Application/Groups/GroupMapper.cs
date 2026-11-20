using Application.Bases.Mapping;
using Application.Bases.Models;
using Domain.Groups;
using Riok.Mapperly.Abstractions;

namespace Application.Groups;

[Mapper]
public static partial class GroupMapper
{
    public static partial GroupVm ToVm(Group group);

    public static PagedResult<GroupVm> ToVm(PagedResult<Group> groups) => MapperConventions.MapPage(groups, ToVm);
}
