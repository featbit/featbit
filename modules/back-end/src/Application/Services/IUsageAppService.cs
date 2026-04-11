namespace Application.Services;

public interface IUsageAppService
{
    Task SaveRecordsAsync(
        Dictionary<Guid, HashSet<string>> endUsers,
        Dictionary<Guid, (int flagEvaluations, int customMetrics)> insights,
        CancellationToken cancellationToken
    );
}