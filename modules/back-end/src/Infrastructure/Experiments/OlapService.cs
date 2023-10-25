using Domain.Experiments;
using Domain.FeatureFlags;
using System.Net.Http.Json;

namespace Infrastructure.Experiments;

public class OlapService : IOlapService
{
    private readonly HttpClient _httpClient;

    public OlapService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<FeatureFlagEndUserStats> GetFeatureFlagEndUserStats(FeatureFlagEndUserParam param)
    {
        param.StartTime *= 1000; // milliseconds to microseconds
        param.EndTime *= 1000; // milliseconds to microseconds
        
        var response = await _httpClient.PostAsJsonAsync("/api/events/stat/enduser", param);

        var result = await response.Content.ReadFromJsonAsync<FeatureFlagEndUserStatsResponse>();

        return result!.Data;
    }
    
    public async Task<ICollection<Insights>> GetFeatureFlagInsights(InsightsParam param)
    {
        param.StartTime *= 1000; // milliseconds to microseconds
        param.EndTime *= 1000; // milliseconds to microseconds
        
        var response = await _httpClient.PostAsJsonAsync("/api/events/stat/featureflag", param);

        var result = await response.Content.ReadFromJsonAsync<InsightsResponse>();

        return result!.Data;
    }

    public async Task<ExperimentIteration> GetExptIterationResultAsync(ExptIterationParam param)
    {
        param.StartExptTime *= 1000; // milliseconds to microseconds
        if (param.EndExptTime.HasValue)
        {
            param.EndExptTime *= 1000; // milliseconds to microseconds
        }

        var response = await _httpClient.PostAsJsonAsync("/api/expt/results", param);

        var result = await response.Content.ReadFromJsonAsync<OlapExptIterationResponse>();

        return new ExperimentIteration
        {
            Id = result!.Data.IterationId,
            StartTime = result.Data.StartTime,
            EndTime = result.Data.EndTime,
            UpdatedAt = DateTime.UtcNow,
            EventType = result.Data.EventType,
            EventName = param.EventName,
            CustomEventTrackOption = result.Data.CustomEventTrackOption,
            CustomEventUnit = result.Data.CustomEventUnit,
            CustomEventSuccessCriteria = result.Data.CustomEventSuccessCriteria,
            Results = result.Data.Results,
            IsFinish = result.Data.IsFinish,
        };
    }
}