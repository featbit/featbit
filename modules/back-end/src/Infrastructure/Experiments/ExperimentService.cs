using Application.Bases.Models;
using Application.ExperimentMetrics;
using Application.Experiments;
using Domain.ExperimentMetrics;
using Domain.Experiments;
using Domain.FeatureFlags;
using Domain.Utils;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Experiments;

public class ExperimentService : MongoDbService<Experiment>, IExperimentService
{
    private readonly IFeatureFlagService _featureFlagService;
    private readonly IOlapService _olapService;
    private readonly IExperimentMetricService _experimentMetricService;

    public ExperimentService(MongoDbClient mongoDb, IFeatureFlagService featureFlagService, IOlapService olapService,
        IExperimentMetricService experimentMetricService) : base(mongoDb)
    {
        _featureFlagService = featureFlagService;
        _olapService = olapService;
        _experimentMetricService = experimentMetricService;
    }

    public async Task ArchiveExperiment(Guid envId, Guid experimentId)
    {
        var experiment = await GetAsync(experimentId);

        var operationTime = DateTime.UtcNow;
        // stop active iterations
        var featureFlag = await _featureFlagService.GetAsync(experiment.FeatureFlagId);
        var metric = await _experimentMetricService.GetAsync(experiment.MetricId);
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
                EndExptTime = iteration.EndTime.HasValue ? iteration.EndTime.Value.ToUnixTimeMilliseconds() : null
            };

            var olapExptResult = await _olapService.GetExptIterationResultAsync(param);
            if (olapExptResult != null)
            {
                iteration.Results = olapExptResult.Results;
                iteration.UpdatedAt = olapExptResult.UpdatedAt;
            }
        }

        experiment.UpdatedAt = operationTime;
        experiment.Status = ExperimentStatus.Paused;
        experiment.IsArchived = true;
        await this.UpdateAsync(experiment);
    }

    public async Task ArchiveIterations(Guid envId, Guid experimentId)
    {
        var experiment = await this.GetAsync(experimentId);

        if (experiment.Iterations.Any())
        {
            var operationTime = DateTime.UtcNow;
            // stop active iterations
            var featureFlag = await _featureFlagService.GetAsync(experiment.FeatureFlagId);
            var metric = await _experimentMetricService.GetAsync(experiment.MetricId);
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
                    EndExptTime = iteration.EndTime.HasValue ? iteration.EndTime.Value.ToUnixTimeMilliseconds() : null
                };

                var olapExptResult = await _olapService.GetExptIterationResultAsync(param);
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

    public async Task<ExperimentIteration> StopIteration(Guid envId, Guid experimentId, string iterationId)
    {
        var experiment = await GetAsync(experimentId);

        var operationTime = DateTime.UtcNow;

        var iteration = experiment.Iterations.FirstOrDefault(i => i.Id == iterationId);

        if (iteration == null)
        {
            return null!;
        }

        if (experiment.Iterations.Any(it => !it.IsFinish))
        {
            experiment.Status = ExperimentStatus.Paused;
        }

        iteration.EndTime = operationTime;
        iteration.IsFinish = true;

        // stop active iterations
        var featureFlag = await _featureFlagService.GetAsync(experiment.FeatureFlagId);
        var metric = await _experimentMetricService.GetAsync(experiment.MetricId);
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
                EndExptTime = it.EndTime.HasValue ? iteration.EndTime.Value.ToUnixTimeMilliseconds() : null
            };

            var olapExptResult = await _olapService.GetExptIterationResultAsync(param);
            if (olapExptResult != null)
            {
                it.Results = olapExptResult.Results;
                it.UpdatedAt = olapExptResult.UpdatedAt;
            }
        }

        await UpdateAsync(experiment);

        return iteration;
    }

    public async Task<ExperimentIteration> StartIteration(Guid envId, Guid experimentId)
    {
        var experiment = await GetAsync(experimentId);

        var operationTime = DateTime.UtcNow;

        if (experiment.Iterations == null)
        {
            experiment.Iterations = new List<ExperimentIteration>();
        }

        // stop active iterations
        var featureFlag = await _featureFlagService.GetAsync(experiment.FeatureFlagId);
        var metric = await _experimentMetricService.GetAsync(experiment.MetricId);
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
                EndExptTime = iteration.EndTime.HasValue ? iteration.EndTime.Value.ToUnixTimeMilliseconds() : null
            };

            var olapExptResult = await _olapService.GetExptIterationResultAsync(param);
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
            // EndTime, Don't need to set end time as this is a start experiment signal
            Results = new List<IterationResult>(),
            CustomEventSuccessCriteria = metric.CustomEventSuccessCriteria,
            CustomEventTrackOption = metric.CustomEventTrackOption,
            CustomEventUnit = metric.CustomEventUnit,
            EventType = (int)metric.EventType,
            EventName = metric.EventName,
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

            if (iteration.IsFinish)
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
                EndExptTime = iteration.EndTime
            };

            var olapExptResults = await _olapService.GetExptIterationResultAsync(param);
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
                join metric in MongoDb.QueryableOf<ExperimentMetric>()
                    on expt.MetricId equals metric.Id
                join ff in MongoDb.QueryableOf<FeatureFlag>()
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
                    Iterations = expt.Iterations
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
                join metric in MongoDb.QueryableOf<ExperimentMetric>()
                    on expt.MetricId equals metric.Id
                join ff in MongoDb.QueryableOf<FeatureFlag>()
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
                    Iterations = expt.Iterations
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