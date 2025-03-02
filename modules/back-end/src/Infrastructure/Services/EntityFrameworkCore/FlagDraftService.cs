using Domain.FlagDrafts;

namespace Infrastructure.Services.EntityFrameworkCore;

public class FlagDraftService(AppDbContext dbContext)
    : EntityFrameworkCoreService<FlagDraft>(dbContext), IFlagDraftService;