using Domain.Triggers;

namespace Infrastructure.Services.EntityFrameworkCore;

public class TriggerService(AppDbContext dbContext) : EntityFrameworkCoreService<Trigger>(dbContext), ITriggerService;