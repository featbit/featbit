using Domain.Projects;

namespace Application.Projects;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Project, ProjectVm>();
    }
}