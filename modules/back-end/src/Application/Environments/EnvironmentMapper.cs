using Application.Bases.Mapping;
using Domain.Environments;
using Riok.Mapperly.Abstractions;
using Environment = Domain.Environments.Environment;

namespace Application.Environments;

[Mapper]
public static partial class EnvironmentMapper
{
    public static partial EnvironmentVm ToVm(Environment environment);

    [UserMapping(Default = true)]
    private static ICollection<Secret> CopySecrets(ICollection<Secret> secrets) => MapperConventions.CopyList(secrets);
}
