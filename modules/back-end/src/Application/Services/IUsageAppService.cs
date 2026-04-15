using Application.Usages;

namespace Application.Services;

public interface IUsageAppService
{
    Task SaveRecordsAsync(AggregatedUsageRecords records);
}