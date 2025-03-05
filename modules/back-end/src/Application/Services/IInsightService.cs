namespace Application.Services;

public interface IInsightService
{
    bool TryParse(string json, out object insight);

    Task AddManyAsync(IEnumerable<object> insights);
}