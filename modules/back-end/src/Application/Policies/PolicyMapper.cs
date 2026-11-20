using Application.Bases.Mapping;
using Application.Bases.Models;
using Domain.Policies;
using Riok.Mapperly.Abstractions;

namespace Application.Policies;

[Mapper]
public static partial class PolicyMapper
{
    public static partial PolicyVm ToVm(Policy policy);

    public static PagedResult<PolicyVm> ToVm(PagedResult<Policy> policies) => MapperConventions.MapPage(policies, ToVm);

    public static List<PolicyVm> ToVm(IEnumerable<Policy> policies) => MapperConventions.MapList(policies, ToVm);

    [UserMapping(Default = true)]
    private static IEnumerable<PolicyStatement> CopyStatements(ICollection<PolicyStatement> statements) =>
        MapperConventions.CopyList(statements);
}
