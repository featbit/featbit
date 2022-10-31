using System.Text;
using Domain.Utils;
using System.Net.Mime;
using System.Text.Json;
using Domain.Experiments;

namespace Infrastructure.Experiments;

public class OlapService : IOlapService
{
    private readonly HttpClient _httpClient;

    public OlapService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<ExperimentIteration> GetExptIterationResultAsync(ExptIterationParam param)
    {
        var content = new StringContent(
            JsonSerializer.Serialize(param, ReusableJsonSerializerOptions.Web),
            Encoding.UTF8, MediaTypeNames.Application.Json
        );

        var response = await _httpClient.PostAsync("/api/expt/results", content);

        var result = JsonSerializer.Deserialize<OlapExptIterationResponse>(
            await response.Content.ReadAsStringAsync(),
            ReusableJsonSerializerOptions.Web
        );

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