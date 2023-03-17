using Domain.Users;

namespace Application.Users;

public class MapperProfile : AutoMapper.Profile
{
    public MapperProfile()
    {
        CreateMap<User, UserVm>();
    }
}