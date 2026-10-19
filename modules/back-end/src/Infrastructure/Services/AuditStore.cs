using System.Data;
using System.Linq.Expressions;
using Domain.Bases;
using Infrastructure.Persistence.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Domain.AuditLogs;
using Microsoft.EntityFrameworkCore.Storage;

namespace Infrastructure.Services;

// Scoped: nested IAM commands participate in the outer transaction.
public class AuditStore(IServiceProvider services)
{
    public bool Active { get; private set; }

    public bool Supported => services.GetService<AppDbContext>() != null;

    public Task<List<T>> Read<T>(Expression<Func<T, bool>> predicate) where T : Entity =>
        services.GetRequiredService<AppDbContext>().Set<T>().AsNoTracking().Where(predicate).ToListAsync();

    public async Task<T> Transaction<T>(Func<Task<T>> action, CancellationToken cancellationToken)
    {
        if (Active) return await action();
        Active = true;
        try
        {
            var db = services.GetRequiredService<AppDbContext>();
            // Serializable snapshots prevent concurrent relationship changes being
            // attributed to the wrong actor. Serialization failures roll back.
            T? savedResult = default;
            Guid[] auditIds = [];
            return await db.Database.CreateExecutionStrategy().ExecuteAsync(0, async (_, _, token) =>
            {
                auditIds = [];
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
                var result = await action();
                savedResult = result;
                auditIds = db.ChangeTracker.Entries<AuditLog>().Select(x => x.Entity.Id).ToArray();
                await transaction.CommitAsync(token);
                return result;
            }, async (_, _, token) => new ExecutionResult<T>(
                auditIds.Length > 0 && await db.Set<AuditLog>().AsNoTracking().CountAsync(x => auditIds.Contains(x.Id), token) == auditIds.Length, savedResult!), cancellationToken);

        }
        finally { Active = false; }
    }
}
