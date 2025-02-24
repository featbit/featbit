namespace Infrastructure.Services.EntityFrameworkCore;

public class InsightService : IInsightService
{
    public bool TryParse(string json, out object insight)
    {
        throw new NotImplementedException();
    }

    public Task AddManyAsync(object[] insights)
    {
        throw new NotImplementedException();
    }
}