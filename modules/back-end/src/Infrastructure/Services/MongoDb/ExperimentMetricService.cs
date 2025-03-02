using Application.Bases.Models;
using Application.ExperimentMetrics;
using Domain.ExperimentMetrics;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class ExperimentMetricService(MongoDbClient mongoDb)
    : MongoDbService<ExperimentMetric>(mongoDb), IExperimentMetricService
{
    public async Task<PagedResult<ExperimentMetric>> GetListAsync(Guid envId, ExperimentMetricFilter metricFilter)
    {
        var query = Queryable.Where(x => x.EnvId == envId && !x.IsArvhived);

        // name filter
        if (!string.IsNullOrWhiteSpace(metricFilter.metricName))
        {
            query = query.Where(x => x.Name.Contains(metricFilter.metricName, StringComparison.CurrentCultureIgnoreCase));
        }

        // event type filter
        if (metricFilter.EventType.HasValue)
        {
            query = query.Where(metric => metric.EventType == metricFilter.EventType.Value);
        }

        var totalCount = await query.CountAsync();

        var itemsQuery = query
            .OrderByDescending(x => x.UpdatedAt)
            .Skip(metricFilter.PageIndex * metricFilter.PageSize)
            .Take(metricFilter.PageSize);

        var items = await itemsQuery.ToListAsync();

        return new PagedResult<ExperimentMetric>(totalCount, items);
    }
}