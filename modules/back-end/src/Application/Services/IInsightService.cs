namespace Application.Services;

public interface IInsightService
{
    bool TryParse(string json, out object insight);

    Task AddManyAsync(object[] insights);
}