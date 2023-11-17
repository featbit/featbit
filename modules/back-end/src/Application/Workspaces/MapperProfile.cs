using Domain.Workspaces;

namespace Application.Workspaces;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Workspace, WorkspaceVm>();
    }
}