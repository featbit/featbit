using System.Linq.Expressions;
using Application.Bases.Exceptions;
using Domain.Bases;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Bases;

public class MongoDbServiceBase<TEntity> where TEntity : Entity
{
    public MongoDbClient MongoDb { get; }

    public MongoDbServiceBase(MongoDbClient mongoDb)
    {
        MongoDb = mongoDb;
    }

    public async Task<TEntity> GetAsync(Guid id)
    {
        var entity = await FindOneAsync(x => x.Id == id);
        if (entity == null)
        {
            throw new EntityNotFoundException(typeof(TEntity).Name, id.ToString());
        }

        return entity;
    }

    public async Task<TEntity?> FindOneAsync(Expression<Func<TEntity, bool>> predicate)
    {
        return await MongoDb.QueryableOf<TEntity>().FirstOrDefaultAsync(predicate);
    }

    public async Task<bool> AnyAsync(Expression<Func<TEntity, bool>> predicate)
    {
        return await MongoDb.QueryableOf<TEntity>().AnyAsync(predicate);
    }

    public async Task AddAsync(TEntity entity)
    {
        await MongoDb.CollectionOf<TEntity>().InsertOneAsync(entity);
    }

    public async Task UpdateAsync(TEntity replacement)
    {
        await MongoDb.CollectionOf<TEntity>()
            .ReplaceOneAsync(entity => entity.Id == replacement.Id, replacement);
    }
}