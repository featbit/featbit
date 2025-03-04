using Domain.FlagRevisions;

namespace Infrastructure.Services.EntityFrameworkCore;

public class FlagRevisionService(AppDbContext dbContext)
    : EntityFrameworkCoreService<FlagRevision>(dbContext), IFlagRevisionService;