using Application.Bases.Models;
using Application.Experiments;
using AutoMapper;
using Domain.Experiments;
using MongoDB.Driver;

namespace Infrastructure.Experiments
{
    public class ExperimentMetricService : MongoDbService<ExperimentMetric>, IExperimentMetricService
    {
        public ExperimentMetricService(MongoDbClient mongoDb) : base(mongoDb)
        {
        }

        public async Task<PagedResult<ExperimentMetric>> GetListAsync(Guid envId, ExperimentMetricFilter metricFilter)
        {
            var filterBuilder = Builders<ExperimentMetric>.Filter;

            var filters = new List<FilterDefinition<ExperimentMetric>>
            {
                // envId filter
                filterBuilder.Eq(metric => metric.EnvId, envId),
                filterBuilder.Eq(metric => metric.IsArvhived, false)
            };

            // name filter
            if (!string.IsNullOrWhiteSpace(metricFilter.Name))
            {
                var nameFilter = filterBuilder.Where(metric =>
                    metric.Name.Contains(metricFilter.Name, StringComparison.CurrentCultureIgnoreCase));
                filters.Add(nameFilter);
            }

            var filter = filterBuilder.And(filters);

            var totalCount = await Collection.CountDocumentsAsync(filter);

            var itemsQuery = Collection
                .Find(filter)
                .SortByDescending(flag => flag.UpdatedAt)
                .Skip(metricFilter.PageIndex * metricFilter.PageSize)
                .Limit(metricFilter.PageSize);

            var items = await itemsQuery.ToListAsync();

            return new PagedResult<ExperimentMetric>(totalCount, items);
        }

        public async Task DeleteAsync(Guid id)
        {
            await Collection.DeleteOneAsync(x => x.Id == id);
        }
    }
}
