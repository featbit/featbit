using Application.Bases.Mapping;
using Application.Bases.Models;
using Domain.Members;
using Riok.Mapperly.Abstractions;

namespace Application.Members;

[Mapper]
public static partial class MemberMapper
{
    public static partial MemberVm ToVm(Member member);

    public static partial MemberLookupVm ToLookupVm(Member member);

    public static partial MemberGroupVm ToVm(MemberGroup group);

    public static PagedResult<MemberVm> ToVm(PagedResult<Member> members) => MapperConventions.MapPage(members, ToVm);

    public static PagedResult<MemberLookupVm> ToLookupVm(PagedResult<Member> members) =>
        MapperConventions.MapPage(members, ToLookupVm);

    public static PagedResult<MemberGroupVm> ToVm(PagedResult<MemberGroup> groups) =>
        MapperConventions.MapPage(groups, ToVm);

    [UserMapping(Default = true)]
    private static IEnumerable<MemberGroupVm> ToVms(IEnumerable<MemberGroup> groups) =>
        MapperConventions.MapList(groups, ToVm);
}
