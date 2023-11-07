using Domain.Accounts;

namespace Application.Services;

public interface IAccountService
{
    Task<IEnumerable<Account>> GetByEmailAsync(string email);
}