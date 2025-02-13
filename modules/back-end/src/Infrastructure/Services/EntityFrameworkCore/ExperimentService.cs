using Application.Bases.Models;
using Application.ExperimentMetrics;
using Application.Experiments;
using Domain.ExperimentMetrics;
using Domain.Experiments;
using Domain.FeatureFlags;
using Domain.Utils;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ExperimentService(AppDbContext dbContext, IOlapService olapService)
    : EntityFrameworkCoreService<Experiment>(dbContext), IExperimentService
{
    public async Task ArchiveExperiment(Guid envId, Guid experimentId)
    {
        var experiment = await GetAsync(experimentId);

        var operationTime = DateTime.UtcNow;

        var featureFlag = await QueryableOf<FeatureFlag>().FirstOrDefaultAsync(x => x.Id == experiment.FeatureFlagId);
        var metric = await QueryableOf<ExperimentMetric>().FirstOrDefaultAsync(x => x.Id == experiment.MetricId);
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
        var experiment = await this.GetAsync(experimentId);

        if (experiment.Iterations.Any())
        {
            // stop active iterations
            var featureFlag = await QueryableOf<FeatureFlag>().FirstOrDefaultAsync(x => x.Id == experiment.FeatureFlagId);
            var metric = await QueryableOf<ExperimentMetric>().FirstOrDefaultAsync(x => x.Id == experiment.MetricId);
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
        
        var featureFlag = await QueryableOf<FeatureFlag>().FirstOrDefaultAsync(x => x.Id == experiment.FeatureFlagId);
        var metric = await QueryableOf<ExperimentMetric>().FirstOrDefaultAsync(x => x.Id == experiment.MetricId);
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
        
        var featureFlag = await QueryableOf<FeatureFlag>().FirstOrDefaultAsync(x => x.Id == experiment.FeatureFlagId);
        var metric = await QueryableOf<ExperimentMetric>().FirstOrDefaultAsync(x => x.Id == experiment.MetricId);
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
        if (string.IsNullOrWhiteSpace(filter.FeatureFlagId.ToString()))
        {
            var query =
                from expt in Queryable
                join metric in QueryableOf<ExperimentMetric>()
                    on expt.MetricId equals metric.Id
                join ff in QueryableOf<FeatureFlag>()
                    on expt.FeatureFlagId equals ff.Id
                where expt.EnvId == envId && !expt.IsArchived && !ff.IsArchived &&
                      (string.IsNullOrWhiteSpace(filter.FeatureFlagName) ||
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
                    MetricCustomEventSuccessCriteria = metric.CustomEventSuccessCriteria,
                    Iterations = expt.Iterations != null
                        ? expt.Iterations.Where(p => !p.IsArchived).ToList()
                        : expt.Iterations,
                    Alpha = expt.Alpha ?? 0.05
                };

            var totalCount = await query.CountAsync();

            List<ExperimentVm> items;

            if (filter.PageSize == -1) // no pagination
            {
                items = await query.ToListAsync();
            }
            else
            {
                items = await query
                    .Skip(filter.PageIndex * filter.PageSize)
                    .Take(filter.PageSize)
                    .ToListAsync();
            }

            return new PagedResult<ExperimentVm>(totalCount, items);
        }
        else
        {
            var query =
                from expt in Queryable
                join metric in QueryableOf<ExperimentMetric>()
                    on expt.MetricId equals metric.Id
                join ff in QueryableOf<FeatureFlag>()
                    on expt.FeatureFlagId equals ff.Id
                where expt.EnvId == envId && !expt.IsArchived && !ff.IsArchived &&
                      expt.FeatureFlagId == filter.FeatureFlagId
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
                    MetricCustomEventSuccessCriteria = metric.CustomEventSuccessCriteria,
                    Iterations = expt.Iterations != null
                        ? expt.Iterations.Where(p => !p.IsArchived).ToList()
                        : expt.Iterations,
                    Alpha = expt.Alpha
                };

            var totalCount = await query.CountAsync();
            List<ExperimentVm> items;

            if (filter.PageSize == -1) // no pagination
            {
                items = await query.ToListAsync();
            }
            else
            {
                items = await query
                    .Skip(filter.PageIndex * filter.PageSize)
                    .Take(filter.PageSize)
                    .ToListAsync();
            }

            return new PagedResult<ExperimentVm>(totalCount, items);
        }
    }
}