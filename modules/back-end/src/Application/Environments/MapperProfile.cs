using Environment = Domain.Environments.Environment;

namespace Application.Environments;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Environment, EnvironmentVm>();
    }
}