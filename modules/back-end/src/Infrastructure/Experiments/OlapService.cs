﻿using System.Text;
using Domain.Utils;
using System.Net.Mime;
using System.Text.Json;
using Domain.Experiments;
using Domain.FeatureFlags;

namespace Infrastructure.Experiments;

public class OlapService : IOlapService
{
    private readonly HttpClient _httpClient;

    public OlapService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }
    
    private async Task<T?> GetFeatureFlagStatusByVariation<T>(string endPoint, Object param)
    {
        var content = new StringContent(
            JsonSerializer.Serialize(param, ReusableJsonSerializerOptions.Web),
            Encoding.UTF8, MediaTypeNames.Application.Json
        );
        
        var response = await _httpClient.PostAsync(endPoint, content);

        return JsonSerializer.Deserialize<T>(
            await response.Content.ReadAsStringAsync(),
            ReusableJsonSerializerOptions.Web
        );
    }

    public async Task<FeatureFlagEndUserStats> GetFeatureFlagEndUserStats(FeatureFlagEndUserParam param)
    {
        param.StartTime = param.StartTime * 1000; // milliseconds to microseconds
        param.EndTime = param.EndTime * 1000; // milliseconds to microseconds
        
        var result = await GetFeatureFlagStatusByVariation<FeatureFlagEndUserStatsResponse>("/api/events/stat/featureflag1", param);

        return result.Data;
    }
    
    public async Task<ICollection<FeatureFlagStats>> GetFeatureFlagStatusByVariation(StatsByVariationParam param)
    {
        param.StartTime = param.StartTime * 1000; // milliseconds to microseconds
        param.EndTime = param.EndTime * 1000; // milliseconds to microseconds
        
        var result = await GetFeatureFlagStatusByVariation<StatsByVariationResponse>("/api/events/stat/featureflag", param);

        return result.Data;
    }

    public async Task<ExperimentIteration> GetExptIterationResultAsync(ExptIterationParam param)
    {
        param.StartExptTime = param.StartExptTime * 1000; // milliseconds to microseconds
        if (param.EndExptTime.HasValue)
        {
            param.EndExptTime = param.EndExptTime * 1000; // milliseconds to microseconds
        }
        
        var result = await GetFeatureFlagStatusByVariation<OlapExptIterationResponse>("/api/expt/results", param);
        
        return new ExperimentIteration
        {
            Id = result.Data.IterationId,
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