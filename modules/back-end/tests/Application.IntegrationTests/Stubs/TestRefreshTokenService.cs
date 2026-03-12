using Application.Services;
using Domain.RefreshTokens;

namespace Application.IntegrationTests.Stubs;

public class TestRefreshTokenService : NullServiceBase<RefreshToken>, IRefreshTokenService;