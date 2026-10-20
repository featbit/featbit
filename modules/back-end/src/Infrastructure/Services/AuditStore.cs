using System.Data;
using System.Linq.Expressions;
using Domain.Bases;
using Infrastructure.Persistence.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Domain.AuditLogs;
using Microsoft.EntityFrameworkCore.Storage;
using Infrastructure.Persistence.MongoDb;

namespace Infrastructure.Services;

// Scoped: nested IAM commands participate in the outer audit operation.
public class AuditStore(IServiceProvider services)
{
    public bool Active { get; private set; }

    public bool Supported => services.GetService<AppDbContext>() != null || services.GetService<MongoDbClient>() != null;

    public Task<List<T>> Read<T>(Expression<Func<T, bool>> predicate) where T : Entity
    {
        var db = services.GetService<AppDbContext>();
        return db != null
            ? db.Set<T>().AsNoTracking().Where(predicate).ToListAsync()
            : MongoDB.Driver.Linq.MongoQueryable.ToListAsync(
                services.GetRequiredService<MongoDbClient>().QueryableOf<T>().Where(predicate));
    }

    public async Task<T> Transaction<T>(Func<Task<T>> action, CancellationToken cancellationToken)
    {
        if (Active) return await action();
        Active = true;
        try
        {
            var db = services.GetService<AppDbContext>();
            if (db == null)
            {
                services.GetRequiredService<MongoDbClient>();
                // Preserve standalone MongoDB support: business writes and audit writes
                // are independent. A later failure does not roll back earlier writes.
                cancellationToken.ThrowIfCancellationRequested();
                return await action();
            }
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
