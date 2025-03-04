using Domain.FlagChangeRequests;

namespace Infrastructure.Services.EntityFrameworkCore;

public class FlagChangeRequestService(AppDbContext dbContext)
    : EntityFrameworkCoreService<FlagChangeRequest>(dbContext), IFlagChangeRequestService;