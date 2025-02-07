using Application.Bases.Models;
using Application.ExperimentMetrics;
using Domain.ExperimentMetrics;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

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
            filterBuilder.Eq(metric => metric.EnvId, envId),
            filterBuilder.Eq(metric => metric.IsArvhived, false)
        };

        // name filter
        if (!string.IsNullOrWhiteSpace(metricFilter.metricName))
        {
            var nameFilter = filterBuilder.Where(metric =>
                metric.Name.Contains(metricFilter.metricName, StringComparison.CurrentCultureIgnoreCase));
            filters.Add(nameFilter);
        }
        
        // event type filter
        if (metricFilter.EventType.HasValue)
        {
            var eventTypeFilter = filterBuilder.Where(metric => metric.EventType == metricFilter.EventType.Value);
            filters.Add(eventTypeFilter);
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
}
