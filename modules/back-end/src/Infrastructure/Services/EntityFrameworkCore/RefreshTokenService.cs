using Domain.RefreshTokens;

namespace Infrastructure.Services.EntityFrameworkCore;

public class RefreshTokenService(AppDbContext dbContext)
    : EntityFrameworkCoreService<RefreshToken>(dbContext), IRefreshTokenService;