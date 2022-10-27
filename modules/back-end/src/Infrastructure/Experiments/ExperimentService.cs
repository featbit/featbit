using Application.Bases.Models;
using Application.Experiments;
using Domain.ExperimentMetrics;
using Domain.Experiments;
using Domain.FeatureFlags;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Experiments;

public class ExperimentService : MongoDbService<Experiment>, IExperimentService
{
    private IMongoQueryable<FeatureFlag> featureFlagQueryable;

    public ExperimentService(MongoDbClient mongoDb) : base(mongoDb)
    {
        featureFlagQueryable = MongoDb.QueryableOf<FeatureFlag>();
    }

    public async Task<PagedResult<ExperimentVm>> GetListAsync(Guid envId, ExperimentFilter filter)
    {
        if (string.IsNullOrWhiteSpace(filter.FeatureFlagId.ToString()))
        {
            var query =
                from expt in Queryable
                join metric in MongoDb.QueryableOf<ExperimentMetric>()
                    on expt.MetricId equals metric.Id
                join ff in featureFlagQueryable
                    on expt.FeatureFlagId equals ff.Id
                where expt.EnvId == envId && !ff.IsArchived && (string.IsNullOrWhiteSpace(filter.FeatureFlagName) ||
                                                                ff.Name.Contains(filter.FeatureFlagName,
                                                                    StringComparison.CurrentCultureIgnoreCase))
                select new ExperimentVm
                {
                    Id = expt.Id,
                    BaselineVariation = ff.Variations.First(v => v.Id == expt.BaselineVariationId),
                    FeatureFlagId = ff.Id,
                    FeatureFlagKey = ff.Key,
                    FeatureFlagName = ff.Name,
                    MetricId = expt.MetricId,
                    MetricName = metric.Name,
                    MetricEventName = metric.EventName,
                    MetricEventType = metric.EventType,
                    MetricCustomEventUnit = metric.CustomEventUnit,
                    Status = expt.Status,
                    MetricCustomEventTrackOption = metric.CustomEventTrackOption,
                    Iterations = expt.Iterations
                };

            var totalCount = await query.CountAsync();
            var items = await query
                .Skip(filter.PageIndex * filter.PageSize)
                .Take(filter.PageSize)
                .ToListAsync();

            return new PagedResult<ExperimentVm>(totalCount, items);
        }
        else
        {
            var query =
                from expt in Queryable
                join metric in MongoDb.QueryableOf<ExperimentMetric>()
                    on expt.MetricId equals metric.Id
                join ff in featureFlagQueryable
                    on expt.FeatureFlagId equals ff.Id
                where expt.EnvId == envId && !ff.IsArchived && expt.FeatureFlagId == filter.FeatureFlagId
                select new ExperimentVm
                {
                    Id = expt.Id,
                    BaselineVariation = ff.Variations.First(v => v.Id == expt.BaselineVariationId),
                    FeatureFlagId = ff.Id,
                    FeatureFlagKey = ff.Key,
                    FeatureFlagName = ff.Name,
                    MetricId = expt.MetricId,
                    MetricName = metric.Name,
                    MetricEventName = metric.EventName,
                    MetricEventType = metric.EventType,
                    MetricCustomEventUnit = metric.CustomEventUnit,
                    Status = expt.Status,
                    MetricCustomEventTrackOption = metric.CustomEventTrackOption,
                    Iterations = expt.Iterations
                };

            var totalCount = await query.CountAsync();
            var items = await query
                .Skip(filter.PageIndex * filter.PageSize)
                .Take(filter.PageSize)
                .ToListAsync();

            return new PagedResult<ExperimentVm>(totalCount, items);
        }
    }
}