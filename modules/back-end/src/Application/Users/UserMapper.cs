using Domain.Users;
using Riok.Mapperly.Abstractions;

namespace Application.Users;

[Mapper]
public static partial class UserMapper
{
    public static partial UserVm ToVm(User user);
}
