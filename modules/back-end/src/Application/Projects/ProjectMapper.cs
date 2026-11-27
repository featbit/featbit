using Domain.Projects;
using Riok.Mapperly.Abstractions;

namespace Application.Projects;

[Mapper]
public static partial class ProjectMapper
{
    public static partial ProjectVm ToVm(Project project);
}
