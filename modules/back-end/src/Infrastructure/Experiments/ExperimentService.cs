using Application.Bases.Models;
using Application.ExperimentMetrics;
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
    private IOlapService olapService;

    public ExperimentService(MongoDbClient mongoDb, IOlapService olapService) : base(mongoDb)
    {
        featureFlagQueryable = MongoDb.QueryableOf<FeatureFlag>();
        olapService = olapService;
    }

    public async Task<IEnumerable<ExperimentIterationResultsVm>> GetIterationResults(Guid envId,
        IEnumerable<ExperimentIterationParam> experimentIterationParam)
    {
        var results = new List<ExperimentIterationResultsVm>();

        foreach (var iteration in experimentIterationParam)
        {
            var iterationResults = new ExperimentIterationResultsVm();
            
            if (iteration.IsFinish)
            {
                iterationResults.IsFinish = true;
                iterationResults.IsUpdated = false;
                results.Add(iterationResults);
                
                continue;
            }

            var param = new ExptIterationParam
            {
                ExptId = iteration.ExptId,
                IterationId = iteration.IterationId,
                EnvId = envId,
                FlagExptId = iteration.FlagExptId,
                BaselineVariationId = iteration.BaselineVariationId,
                VariationIds = iteration.VariationIds,
                EventName = iteration.EventName,
                EventType = iteration.EventType,
                CustomEventTrackOption = (int)iteration.CustomEventTrackOption,
                CustomEventSuccessCriteria = (int)iteration.CustomEventSuccessCriteria,
                CustomEventUnit = iteration.CustomEventUnit,
                StartExptTime = iteration.StartTime.ToString("yyyy-MM-ddTHH:mm:ss.ffffff"),
                EndExptTime = iteration.EndTime?.ToString("yyyy-MM-ddTHH:mm:ss.ffffff")
            };
            
            var olapExptResults = await olapService.GetExptIterationResultAsync(param);
            if (olapExptResults != null)
            {
                iterationResults.IsFinish = olapExptResults.IsFinish;
                iterationResults.Results = olapExptResults.Results;
                iterationResults.UpdatedAt = olapExptResults.UpdatedAt;
                iterationResults.IsUpdated = true;
            }
            
            results.Add(iterationResults);
        }
            
        return results;
    }

    public async Task<IEnumerable<ExperimentStatusCountVm>> GetStatusCountAsync(Guid envId)
    {
        var query = Queryable.GroupBy(expt => expt.Status)
            .Select(group => new ExperimentStatusCountVm { Status = group.Key, Count = group.Count() });
        
        return await query.ToListAsync();
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