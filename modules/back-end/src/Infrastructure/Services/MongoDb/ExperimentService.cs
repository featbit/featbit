using Application.Bases.Models;
using Application.ExperimentMetrics;
using Application.Experiments;
using Domain.ExperimentMetrics;
using Domain.Experiments;
using Domain.FeatureFlags;
using Domain.Utils;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class ExperimentService(MongoDbClient mongoDb, IOlapService olapService)
    : MongoDbService<Experiment>(mongoDb), IExperimentService
{
    public async Task ArchiveExperiment(Guid envId, Guid experimentId)
    {
        var experiment = await GetAsync(experimentId);

        var operationTime = DateTime.UtcNow;

        var featureFlag = await MongoDb.QueryableOf<FeatureFlag>().FirstOrDefaultAsync(x => x.Id == experiment.FeatureFlagId);
        var metric = await MongoDb.QueryableOf<ExperimentMetric>().FirstOrDefaultAsync(x => x.Id == experiment.MetricId);
        if (featureFlag == null || metric == null)
        {
            return;
        }

        // stop active iterations
        foreach (var iteration in experiment.Iterations.Where(x => !x.EndTime.HasValue))
        {
            iteration.EndTime = operationTime;
            iteration.IsFinish = true;

            var param = new ExptIterationParam
            {
                ExptId = experiment.Id,
                IterationId = iteration.Id,
                EnvId = envId,
                FlagExptId = $"{envId}-{featureFlag.Key}",
                BaselineVariationId = experiment.BaselineVariationId,
                VariationIds = featureFlag.Variations.Select(x => x.Id),
                EventName = metric.EventName,
                EventType = (int)metric.EventType,
                CustomEventTrackOption = (int)iteration.CustomEventTrackOption,
                CustomEventSuccessCriteria = (int)iteration.CustomEventSuccessCriteria,
                CustomEventUnit = iteration.CustomEventUnit,
                StartExptTime = iteration.StartTime.ToUnixTimeMilliseconds(),
                EndExptTime = iteration.EndTime?.ToUnixTimeMilliseconds()
            };

            var olapExptResult = await olapService.GetExptIterationResultAsync(param);
            if (olapExptResult != null)
            {
                iteration.Results = olapExptResult.Results;
                iteration.UpdatedAt = olapExptResult.UpdatedAt;
            }
        }

        experiment.UpdatedAt = operationTime;
        experiment.Status = ExperimentStatus.Paused;
        experiment.IsArchived = true;

        await UpdateAsync(experiment);
    }

    public async Task ArchiveIterations(Guid envId, Guid experimentId)
    {
        var experiment = await GetAsync(experimentId);

        if (experiment.Iterations.Any())
        {
            // stop active iterations
            var featureFlag = await MongoDb.QueryableOf<FeatureFlag>().FirstOrDefaultAsync(x => x.Id == experiment.FeatureFlagId);
            var metric = await MongoDb.QueryableOf<ExperimentMetric>().FirstOrDefaultAsync(x => x.Id == experiment.MetricId);
            if (featureFlag == null || metric == null)
            {
                return;
            }

            var operationTime = DateTime.UtcNow;
            foreach (var iteration in experiment.Iterations.Where(x => !x.EndTime.HasValue))
            {
                iteration.EndTime = operationTime;
                iteration.IsFinish = true;

                var param = new ExptIterationParam
                {
                    ExptId = experiment.Id,
                    IterationId = iteration.Id,
                    EnvId = envId,
                    FlagExptId = $"{envId}-{featureFlag.Key}",
                    BaselineVariationId = experiment.BaselineVariationId,
                    VariationIds = featureFlag.Variations.Select(x => x.Id),
                    EventName = metric.EventName,
                    EventType = (int)metric.EventType,
                    CustomEventTrackOption = (int)iteration.CustomEventTrackOption,
                    CustomEventSuccessCriteria = (int)iteration.CustomEventSuccessCriteria,
                    CustomEventUnit = iteration.CustomEventUnit,
                    StartExptTime = iteration.StartTime.ToUnixTimeMilliseconds(),
                    EndExptTime = iteration.EndTime?.ToUnixTimeMilliseconds(),
                    Alpha = experiment.Alpha
                };

                var olapExptResult = await olapService.GetExptIterationResultAsync(param);
                if (olapExptResult != null)
                {
                    iteration.Results = olapExptResult.Results;
                    iteration.UpdatedAt = olapExptResult.UpdatedAt;
                }
            }

            experiment.UpdatedAt = operationTime;
            experiment.Status = ExperimentStatus.NotStarted;
            experiment.Iterations.ForEach(it => it.IsArchived = true);
            await this.UpdateAsync(experiment);
        }
    }

    public async Task StopAsync(Guid envId, Guid experimentId)
    {
        var experiment = await GetAsync(experimentId);

        var operationTime = DateTime.UtcNow;

        var hasRunningIteration = experiment.Iterations.Any(i => !i.IsFinish);
        if (!hasRunningIteration)
        {
            return;
        }

        experiment.Status = ExperimentStatus.Paused;
        
        var featureFlag = await MongoDb.QueryableOf<FeatureFlag>().FirstOrDefaultAsync(x => x.Id == experiment.FeatureFlagId);
        var metric = await MongoDb.QueryableOf<ExperimentMetric>().FirstOrDefaultAsync(x => x.Id == experiment.MetricId);
        if (featureFlag == null || metric == null)
        {
            return;
        }

        // stop active iterations
        foreach (var it in experiment.Iterations.Where(x => !x.EndTime.HasValue))
        {
            it.EndTime = operationTime;
            it.IsFinish = true;
            it.UpdatedAt = operationTime;

            var param = new ExptIterationParam
            {
                ExptId = experiment.Id,
                IterationId = it.Id,
                EnvId = envId,
                FlagExptId = $"{envId}-{featureFlag.Key}",
                BaselineVariationId = experiment.BaselineVariationId,
                VariationIds = featureFlag.Variations.Select(x => x.Id),
                EventName = metric.EventName,
                EventType = (int)metric.EventType,
                CustomEventTrackOption = (int)it.CustomEventTrackOption,
                CustomEventSuccessCriteria = (int)it.CustomEventSuccessCriteria,
                CustomEventUnit = it.CustomEventUnit,
                StartExptTime = it.StartTime.ToUnixTimeMilliseconds(),
                EndExptTime = it.EndTime.Value.ToUnixTimeMilliseconds()
            };

            var olapExptResult = await olapService.GetExptIterationResultAsync(param);
            if (olapExptResult != null)
            {
                it.Results = olapExptResult.Results;
                it.UpdatedAt = olapExptResult.UpdatedAt;
            }
        }

        await UpdateAsync(experiment);
    }

    public async Task<ExperimentIteration?> StartAsync(Guid envId, Guid experimentId)
    {
        var experiment = await GetAsync(experimentId);

        var operationTime = DateTime.UtcNow;

        experiment.Iterations ??= new List<ExperimentIteration>();
        
        var featureFlag = await MongoDb.QueryableOf<FeatureFlag>().FirstOrDefaultAsync(x => x.Id == experiment.FeatureFlagId);
        var metric = await MongoDb.QueryableOf<ExperimentMetric>().FirstOrDefaultAsync(x => x.Id == experiment.MetricId);
        if (featureFlag == null || metric == null)
        {
            return null;
        }

        // stop active iterations
        foreach (var iteration in experiment.Iterations.Where(x => !x.EndTime.HasValue))
        {
            iteration.EndTime = operationTime;
            iteration.IsFinish = true;

            var param = new ExptIterationParam
            {
                ExptId = experiment.Id,
                IterationId = iteration.Id,
                EnvId = envId,
                FlagExptId = $"{envId}-{featureFlag.Key}",
                BaselineVariationId = experiment.BaselineVariationId,
                VariationIds = featureFlag.Variations.Select(x => x.Id),
                EventName = metric.EventName,
                EventType = (int)metric.EventType,
                CustomEventTrackOption = (int)iteration.CustomEventTrackOption,
                CustomEventSuccessCriteria = (int)iteration.CustomEventSuccessCriteria,
                CustomEventUnit = iteration.CustomEventUnit,
                StartExptTime = iteration.StartTime.ToUnixTimeMilliseconds(),
                EndExptTime = iteration.EndTime?.ToUnixTimeMilliseconds()
            };

            var olapExptResult = await olapService.GetExptIterationResultAsync(param);
            if (olapExptResult != null)
            {
                iteration.Results = olapExptResult.Results;
                iteration.UpdatedAt = olapExptResult.UpdatedAt;
            }
        }

        // start new iteration
        var newIteration = new ExperimentIteration
        {
            Id = Guid.NewGuid().ToString(),
            StartTime = operationTime,
            Results = [],
            CustomEventSuccessCriteria = metric.CustomEventSuccessCriteria,
            CustomEventTrackOption = metric.CustomEventTrackOption,
            CustomEventUnit = metric.CustomEventUnit,
            EventType = (int)metric.EventType,
            EventName = metric.EventName
        };

        experiment.Iterations.Add(newIteration);
        experiment.Status = ExperimentStatus.Recording;

        await UpdateAsync(experiment);

        return newIteration;
    }

    public async Task<IEnumerable<ExperimentIterationResultsVm>> GetIterationResults(Guid envId,
        IEnumerable<ExperimentIterationParam> experimentIterationParam)
    {
        var results = new List<ExperimentIterationResultsVm>();

        foreach (var iteration in experimentIterationParam)
        {
            var experiment = await GetAsync(iteration.ExptId);
            var targetIteration = experiment?.Iterations?.FirstOrDefault(it => it.Id == iteration.IterationId);

            if (experiment == null || targetIteration == null)
            {
                continue;
            }

            var iterationResults = new ExperimentIterationResultsVm
            {
                Id = iteration.IterationId
            };

            if (targetIteration.IsLocked())
            {
                iterationResults.IsFinish = true;
                iterationResults.IsUpdated = false;
                iterationResults.Results = targetIteration.Results;
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
                StartExptTime = iteration.StartTime,
                EndExptTime = targetIteration.EndTime?.ToUnixTimeMilliseconds(),
                Alpha = experiment.Alpha
            };

            var olapExptResults = await olapService.GetExptIterationResultAsync(param);
            if (olapExptResults != null)
            {
                iterationResults.IsFinish = olapExptResults.IsFinish;
                iterationResults.Results = olapExptResults.Results;
                iterationResults.UpdatedAt = olapExptResults.UpdatedAt;
                iterationResults.IsUpdated = true;

                targetIteration.IsFinish = olapExptResults.IsFinish;
                targetIteration.Results = olapExptResults.Results;
                targetIteration.UpdatedAt = olapExptResults.UpdatedAt;
                await UpdateAsync(experiment);
            }

            results.Add(iterationResults);
        }

        return results;
    }

    public async Task<IEnumerable<ExperimentStatusCountVm>> GetStatusCountAsync(Guid envId)
    {
        var query = Queryable
            .Where(x => x.EnvId == envId && !x.IsArchived)
            .GroupBy(expt => expt.Status)
            .Select(group => new ExperimentStatusCountVm
            {
                Status = group.Key,
                Count = group.Count()
            });

        return await query.ToListAsync();
    }

    public async Task<PagedResult<ExperimentVm>> GetListAsync(Guid envId, ExperimentFilter filter)
    {
        var flags = MongoDb.QueryableOf<FeatureFlag>();
        var metrics = MongoDb.QueryableOf<ExperimentMetric>();

        if (!string.IsNullOrWhiteSpace(filter.FeatureFlagName))
        {
            flags = flags.Where(x => x.Name.Contains(filter.FeatureFlagName));
        }

        if (filter.FeatureFlagId.HasValue)
        {
            flags = flags.Where(x => x.Id == filter.FeatureFlagId.Value);
        }

        var query = from flag in flags
            join experiment in Queryable on flag.Id equals experiment.FeatureFlagId
            join metric in metrics on experiment.MetricId equals metric.Id
            where experiment.EnvId == envId && !experiment.IsArchived
            select new ExperimentVm
            {
                Id = experiment.Id,
                BaselineVariationId = experiment.BaselineVariationId,
                Variations = flag.Variations,
                FeatureFlagId = flag.Id,
                FeatureFlagKey = flag.Key,
                FeatureFlagName = flag.Name,
                MetricId = experiment.MetricId,
                MetricName = metric.Name,
                MetricEventName = metric.EventName,
                MetricEventType = metric.EventType,
                MetricCustomEventUnit = metric.CustomEventUnit,
                Status = experiment.Status,
                MetricCustomEventTrackOption = metric.CustomEventTrackOption,
                MetricCustomEventSuccessCriteria = metric.CustomEventSuccessCriteria,
                Iterations = experiment.Iterations,
                Alpha = experiment.Alpha
            };

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip(filter.PageIndex * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        foreach (var item in items)
        {
            item.Iterations = item.Iterations != null
                ? item.Iterations.Where(p => !p.IsArchived).ToList()
                : item.Iterations;
            item.BaselineVariation = item.Variations.FirstOrDefault(x => x.Id == item.BaselineVariationId);
            item.Alpha ??= 0.05;
        }

        return new PagedResult<ExperimentVm>(totalCount, items);
    }
}