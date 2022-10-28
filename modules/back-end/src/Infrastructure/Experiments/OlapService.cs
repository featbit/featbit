using System.Text.Json;
using Domain.Experiments;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Experiments;

public class OlapService : IOlapService
{
    private string Endpoint { get; }

    public OlapService(IConfiguration configuration)
    {
        Endpoint = configuration["OLAP:ServiceHost"];
    }

    public async Task<ExperimentIteration> GetExptIterationResultAsync(ExptIterationParam param)
    {
        using var client = new HttpClient();
        HttpContent content = new StringContent(JsonSerializer.Serialize(param));
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

        var res = await client.PostAsync($"{Endpoint}/api/expt/results", content);

        if (res.StatusCode != System.Net.HttpStatusCode.OK)
        {
            return null;
        }
        
        var response = JsonSerializer.Deserialize<OlapExptIterationResponse>(
            await res.Content.ReadAsStringAsync(),
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

        if (!(response is { Code: (int)System.Net.HttpStatusCode.OK }))
        {
            return null;
        }

        return new ExperimentIteration
        {
            Id = response.Data.IterationId,
            StartTime = response.Data.StartTime,
            EndTime = response.Data.EndTime,
            UpdatedAt = DateTime.UtcNow,
            EventType = response.Data.EventType,
            EventName = param.EventName,
            CustomEventTrackOption = response.Data.CustomEventTrackOption,
            CustomEventUnit = response.Data.CustomEventUnit,
            CustomEventSuccessCriteria = response.Data.CustomEventSuccessCriteria,
            Results = response.Data.Results,
            IsFinish = response.Data.IsFinish,
        };
    }
}