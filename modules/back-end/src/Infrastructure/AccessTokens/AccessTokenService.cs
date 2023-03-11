using Application.Bases.Models;
using Application.Policies;
using Domain.AccessTokens;
using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.AccessTokens;

public class AccessTokenService : MongoDbService<AccessToken>, IAccessTokenService
{
    public AccessTokenService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }
}