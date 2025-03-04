using System.Data;
using System.Linq.Expressions;
using Application.Bases.Exceptions;
using Domain.Bases;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class EntityFrameworkCoreService<TEntity>(AppDbContext dbContext) : IService<TEntity>
    where TEntity : Entity
{
    protected IQueryable<TEntity> Queryable => dbContext.Set<TEntity>().AsQueryable();

    protected IQueryable<TOtherEntity> QueryableOf<TOtherEntity>() where TOtherEntity : class =>
        dbContext.Set<TOtherEntity>().AsQueryable();

    protected DbSet<TEntity> Set => dbContext.Set<TEntity>();

    protected DbSet<TOtherEntity> SetOf<TOtherEntity>() where TOtherEntity : class => dbContext.Set<TOtherEntity>();

    protected IDbConnection DbConnection => dbContext.Database.GetDbConnection();

    protected async Task<int> SaveChangesAsync() => await dbContext.SaveChangesAsync();

    public async Task<TEntity> GetAsync(Guid id)
    {
        var entity = await FindOneAsync(x => x.Id == id);
        if (entity == null)
        {
            throw new EntityNotFoundException(typeof(TEntity).Name, id.ToString());
        }

        return entity;
    }

    public async Task AddOneAsync(TEntity segment)
    {
        await Set.AddAsync(segment);
        await SaveChangesAsync();
    }

    public async Task AddManyAsync(IEnumerable<TEntity> entities)
    {
        Set.AddRange(entities);
        await SaveChangesAsync();
    }

    public async Task<TEntity?> FindOneAsync(Expression<Func<TEntity, bool>> predicate)
    {
        return await Queryable.FirstOrDefaultAsync(predicate);
    }

    public async Task<ICollection<TEntity>> FindManyAsync(Expression<Func<TEntity, bool>> predicate)
    {
        return await Queryable.Where(predicate).ToListAsync();
    }

    public async Task<bool> AnyAsync(Expression<Func<TEntity, bool>> predicate)
    {
        return await Queryable.CountAsync(predicate) > 0;
    }

    public async Task UpdateAsync(TEntity segment)
    {
        Set.Update(segment);

        await SaveChangesAsync();
    }

    public async Task DeleteOneAsync(Guid id) => await Queryable.Where(x => x.Id == id).ExecuteDeleteAsync();
}