using Application.Bases.Models;
using Application.Policies;
using Domain.AccessTokens;
using Domain.Policies;

namespace Application.Services;

public interface IAccessTokenService : IService<AccessToken>
{
}